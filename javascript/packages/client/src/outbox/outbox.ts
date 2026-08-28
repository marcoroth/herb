import { HERB_ATTRIBUTES } from "../grammar/attributes"

import { report } from "../shared/report"
import { scopeOf } from "../state/scopes"

import type { Slots } from "../slots/slots"
import type { State } from "../state/state"
import type { StateValues } from "../state/types"
import type { Collected, Item, Payload, Slot } from "../types"
import type { HeaderMap, MutationFields, MutationRequest, MutationResult, MutationStatus, MutationTarget, MutationTransport, OutboxOptions, Sending, SubmitOptions } from "./types"

export class Outbox {
  private readonly slots: Slots
  private readonly state: State
  private readonly options: OutboxOptions
  private readonly records = new Map<string, Sending>()

  private observed: Document | Element | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private controller = new AbortController()
  private minted = 0

  constructor(slots: Slots, state: State, options: OutboxOptions = {}) {
    this.slots = slots
    this.state = state
    this.options = options
  }

  submit(options: SubmitOptions): Promise<MutationResult> {
    const key = options.key ?? `herb-pending-${(this.minted += 1)}`
    const slot = this.collection(options.into)

    let item: Item | null = null

    if (slot) {
      item = this.slots.addItem(slot, key, { values: options.values, text: true })
    }

    const record: Sending = { options, key, slot: null }

    if (slot && item) {
      this.setStates(slot, item, { pending: true, failed: false })

      record.slot = slot
    }

    this.records.set(key, record)

    return this.enqueue(record)
  }

  retry(target: string | Element): Promise<MutationResult> | null {
    const key = this.keyOf(target)
    const record = key === null ? undefined : this.records.get(key)

    if (key === null || !record) {
      this.reportUnsent("retry", target, key)

      return null
    }

    const item = record.slot?.items.get(key) ?? null

    if (record.slot && item) {
      this.setStates(record.slot, item, { pending: true, failed: false })
    }

    return this.enqueue(record)
  }

  discard(target: string | Element): boolean {
    const key = this.keyOf(target)
    const record = key === null ? undefined : this.records.get(key)

    if (key === null || !record) {
      this.reportUnsent("discard", target, key)

      return false
    }

    this.records.delete(key)

    if (record.slot) {
      return this.slots.removeItem(record.slot, key)
    }

    return true
  }

  observe(root: Document | Element = document): void {
    if (typeof document === "undefined") {
      return
    }

    this.observed?.removeEventListener("submit", this.onSubmit, true)
    this.observed = root

    root.addEventListener("submit", this.onSubmit, true)
  }

  unobserve(): void {
    this.observed?.removeEventListener("submit", this.onSubmit, true)
    this.observed = null
  }

  submitForm(form: HTMLFormElement): Promise<MutationResult> | null {
    const name = form.getAttribute(HERB_ATTRIBUTES.into)
    const region = this.state.scopeFor(form)?.region

    if (name === null || name === "" || !region) {
      return null
    }

    const collection = this.slots.slot(region.file, name, region.occurrence)

    if (!collection || collection.type !== "collection") {
      let message = `\`${HERB_ATTRIBUTES.into}="${name}"\` names nothing in this template.`

      if (collection) {
        message = `\`${HERB_ATTRIBUTES.into}="${name}"\` names a ${collection.type} slot, and a send needs a collection.`
      }

      report({
        template: region.file,
        message,
        code: "herb-unknown-collection",
        severity: "error",
        suggestion: `name a keyed collection, the element carrying \`data-herb-name\` around the loop`,
        value: name,
      })

      return null
    }

    const body = new FormData(form)
    const values: MutationFields = {}

    for (const [key, value] of body.entries()) {
      if (typeof value === "string") {
        values[valueName(key)] = value
      }
    }

    const result = this.submit({
      url: form.getAttribute("action") ?? form.action,
      method: (form.getAttribute("method") ?? "post").toUpperCase(),
      body,
      into: { file: region.file, name, occurrence: region.occurrence },
      values,
    })

    form.reset()
    this.state.resetBound(form)

    return result
  }

  private onSubmit = (event: Event): void => {
    const form = event.target

    if (!(form instanceof HTMLFormElement)) {
      return
    }

    if (!form.hasAttribute(HERB_ATTRIBUTES.into)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    this.submitForm(form)
  }

  private reportUnsent(operation: string, target: string | Element, key: string | null): void {
    const element = target instanceof Element ? target : null
    const scope = element ? this.state.scopeFor(element) : null
    const named = key === null ? "names no row this outbox holds" : `names the row \`${key}\`, which this outbox never sent`

    report({
      template: scope?.region.file ?? "",
      element,
      message: `\`outbox.${operation}\` ${named}, so nothing happened.`,
      code: "herb-unsent-mutation",
      severity: "warning",
      suggestion: "send the write through `outbox.submit` so the outbox can retry it, or handle the failure where the request was made",
    })
  }

  private keyOf(target: string | Element): string | null {
    if (typeof target === "string") {
      return target
    }

    return this.state.scopeFor(target)?.item?.key ?? null
  }

  abort(): void {
    this.controller.abort()
    this.controller = new AbortController()
  }

  private enqueue(record: Sending): Promise<MutationResult> {
    const result = this.queue.then(() => this.send(record))

    this.queue = result.catch(() => undefined)

    return result
  }

  private async send(record: Sending): Promise<MutationResult> {
    const { options, key } = record
    let payload: Payload | null = null

    try {
      payload = await this.transport()(this.request(options), this.controller.signal)
    } catch (error) {
      this.fail(record)

      return { status: statusOf(record.slot, "failed"), key, error: error as Error }
    }

    return this.confirm(record, payload)
  }

  private confirm(record: Sending, payload: Payload | null): MutationResult {
    const { options, key } = record
    const slot = record.slot

    if (!payload) {
      this.settle(record)

      return { status: statusOf(slot, "confirmed"), key }
    }

    let confirmed = key

    if (slot) {
      const real = (options.confirmKey ?? this.realKey.bind(this))(payload, key)

      if (real && real !== key) {
        if (this.slots.rekeyItem(slot, key, real)) {
          confirmed = real
        } else {
          this.slots.removeItem(slot, key)
        }
      }
    }

    let narrowed = payload

    if (slot) {
      narrowed = this.narrow(payload, slot)
    }

    const report = this.slots.apply(narrowed, { items: "merge" })

    if (report.applied === 0 && report.deferred.some((deferred) => deferred.reason === "stale-version")) {
      this.settle(record, confirmed)
      this.records.delete(key)

      return { status: "stale", key: confirmed, report }
    }

    this.settle(record, confirmed)
    this.records.delete(key)

    return { status: statusOf(slot, "confirmed"), key: confirmed, report }
  }

  private settle(record: Sending, confirmed?: string): void {
    const slot = record.slot
    const item = slot?.items.get(confirmed ?? record.key) ?? null

    if (slot && item) {
      this.setStates(slot, item, { pending: false, failed: false })
    }
  }

  private fail(record: Sending): void {
    const slot = record.slot
    const item = slot?.items.get(record.key) ?? null

    if (slot && item) {
      this.setStates(slot, item, { pending: false, failed: true })
    }
  }

  private setStates(slot: Slot, item: Item, values: StateValues): void {
    const region = this.slots.regionOf(slot)

    if (!region) {
      return
    }

    const scope = scopeOf(region, item)
    const declared = Object.fromEntries(Object.entries(values).filter(([name]) => this.state.declares(scope, name)))

    if (Object.keys(declared).length === 0) {
      return
    }

    this.state.setState(declared, { scope })
  }

  private collection(target: MutationTarget): Slot | null {
    const index = target.name ?? target.index

    if (index === undefined) {
      return null
    }

    const slot = this.slots.slot(target.file, index, target.occurrence ?? 0)

    return slot?.type === "collection" ? slot : null
  }

  private realKey(payload: Payload, temp: string): string | null {
    for (const value of Object.values(payload.slots)) {
      if (typeof value !== "object" || value === null || !("items" in value)) {
        continue
      }

      const keys = Object.keys((value as Collected).items).filter((key) => key !== temp)

      if (keys.length === 1) {
        return keys[0]
      }

      if (keys.length > 1) {
        report({
          template: payload.template,
          message: `A confirm carried ${keys.length} rows, so the optimistic row cannot tell which one it became and keeps its temporary key.`,
          code: "herb-ambiguous-confirm",
          severity: "warning",
          suggestion: `render only the created row in the confirm response, or pass \`confirmKey\` to \`submit\``,
        })
      }
    }

    return null
  }

  private narrow(payload: Payload, slot: Slot): Payload {
    const value = payload.slots[slot.index]

    if (value === undefined) {
      return payload
    }

    return { ...payload, slots: { [slot.index]: value } }
  }

  private request(options: SubmitOptions): MutationRequest {
    const headers: HeaderMap = {
      Accept: "application/vnd.herb.slots+json",
      ...this.options.headers?.(),
    }

    const token = typeof document === "undefined" ? null : document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content

    if (token && !headers["X-CSRF-Token"]) {
      headers["X-CSRF-Token"] = token
    }

    return {
      url: options.url,
      method: (options.method ?? "post").toUpperCase(),
      body: options.body,
      headers,
    }
  }

  private transport(): MutationTransport {
    return this.options.transport ?? defaultTransport(this.options.format ?? "slots")
  }
}

function defaultTransport(format: string): MutationTransport {
  return async (request, signal) => {
    const url = new URL(request.url, window.location.href)

    url.searchParams.set("format", format)

    let body: FormData | URLSearchParams | undefined

    if (request.body instanceof FormData) {
      body = request.body
    } else if (request.body) {
      body = new URLSearchParams(request.body)
    }

    const response = await fetch(url.toString(), {
      method: request.method,
      body,
      headers: request.headers,
      signal,
    })

    if (!response.ok) {
      throw new Error(`Herb mutation failed with ${response.status}`)
    }

    return (await response.json()) as Payload
  }
}

function statusOf(slot: Slot | null, attached: MutationStatus): MutationStatus {
  if (!slot) {
    return "detached"
  }

  return attached
}

function valueName(key: string): string {
  const segments = [...key.matchAll(/\[([^\[\]]+)\]/g)]

  if (segments.length === 0) {
    return key
  }

  return segments[segments.length - 1][1]
}
