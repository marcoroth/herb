import type { ApplyReport, Collected, Item, ItemValues, Payload, Slot, SlotIndex } from "./slot-index"
import type { SlotState, StateScope } from "./state"

export interface MutationTarget {
  file: string
  index?: number
  name?: string
  occurrence?: number
}

export interface SubmitOptions {
  url: string
  method?: string
  body?: FormData | Record<string, string>
  into: MutationTarget
  values?: ItemValues
  key?: string
  confirmKey?: (payload: Payload, temp: string) => string | null
  scope?: "collection" | "payload"
}

export type MutationStatus = "confirmed" | "failed" | "stale" | "detached"

export interface MutationResult {
  status: MutationStatus
  key: string
  report?: ApplyReport
  error?: Error
}

export interface MutationRequest {
  url: string
  method: string
  body: FormData | Record<string, string> | undefined
  headers: Record<string, string>
}

export type MutationTransport = (request: MutationRequest, signal: AbortSignal) => Promise<Payload | null>

export interface MutationsOptions {
  transport?: MutationTransport
  headers?: () => Record<string, string>
  format?: string
}

interface Sending {
  options: SubmitOptions
  key: string
  slot: Slot | null
}

export class SlotMutations {
  readonly #slots: SlotIndex
  readonly #state: SlotState
  readonly #options: MutationsOptions
  readonly #records = new Map<string, Sending>()

  #queue: Promise<unknown> = Promise.resolve()
  #controller = new AbortController()
  #minted = 0

  constructor(slots: SlotIndex, state: SlotState, options: MutationsOptions = {}) {
    this.#slots = slots
    this.#state = state
    this.#options = options
  }

  submit(options: SubmitOptions): Promise<MutationResult> {
    const key = options.key ?? `herb-pending-${(this.#minted += 1)}`
    const slot = this.#collection(options.into)
    const item = slot ? this.#slots.addItem(slot, key, { values: options.values, text: true }) : null

    if (slot && item) this.#setStates(slot, item, { pending: true, failed: false })

    const record: Sending = { options, key, slot: item ? slot : null }

    this.#records.set(key, record)

    return this.#enqueue(record)
  }

  retry(key: string): Promise<MutationResult> | null {
    const record = this.#records.get(key)

    if (!record) return null

    const item = record.slot?.items.get(key) ?? null

    if (record.slot && item) this.#setStates(record.slot, item, { pending: true, failed: false })

    return this.#enqueue(record)
  }

  discard(key: string): boolean {
    const record = this.#records.get(key)

    if (!record) return false

    this.#records.delete(key)

    if (record.slot) return this.#slots.removeItem(record.slot, key)

    return true
  }

  abort(): void {
    this.#controller.abort()
    this.#controller = new AbortController()
  }

  #enqueue(record: Sending): Promise<MutationResult> {
    const result = this.#queue.then(() => this.#send(record))

    this.#queue = result.catch(() => undefined)

    return result
  }

  async #send(record: Sending): Promise<MutationResult> {
    const { options, key } = record
    let payload: Payload | null = null

    try {
      payload = await this.#transport()(this.#request(options), this.#controller.signal)
    } catch (error) {
      this.#fail(record)

      return { status: record.slot ? "failed" : "detached", key, error: error as Error }
    }

    return this.#confirm(record, payload)
  }

  #confirm(record: Sending, payload: Payload | null): MutationResult {
    const { options, key } = record
    const slot = record.slot

    if (!payload) {
      this.#settle(record)

      return { status: slot ? "confirmed" : "detached", key }
    }

    let confirmed = key

    if (slot) {
      const real = (options.confirmKey ?? this.#realKey.bind(this))(payload, key)

      if (real && real !== key) {
        if (this.#slots.rekeyItem(slot, key, real)) confirmed = real
        else this.#slots.removeItem(slot, key)
      }
    }

    const narrowed = slot && (options.scope ?? "collection") === "collection" ? this.#narrow(payload, slot) : payload
    const report = this.#slots.apply(narrowed, { items: "merge" })

    if (report.applied === 0 && report.deferred.some((deferred) => deferred.reason === "stale-version")) {
      this.#settle(record, confirmed)
      this.#records.delete(key)

      return { status: "stale", key: confirmed, report }
    }

    this.#settle(record, confirmed)
    this.#records.delete(key)

    return { status: slot ? "confirmed" : "detached", key: confirmed, report }
  }

  #settle(record: Sending, confirmed?: string): void {
    const slot = record.slot
    const item = slot?.items.get(confirmed ?? record.key) ?? null

    if (slot && item) this.#setStates(slot, item, { pending: false, failed: false })
  }

  #fail(record: Sending): void {
    const slot = record.slot
    const item = slot?.items.get(record.key) ?? null

    if (slot && item) this.#setStates(slot, item, { pending: false, failed: true })
  }

  #setStates(slot: Slot, item: Item, values: Record<string, boolean>): void {
    const region = this.#slots.regionOf(slot)

    if (!region) return

    const scope: StateScope = { region, item }

    this.#state.setState(values, { scope })
  }

  #collection(target: MutationTarget): Slot | null {
    const index = target.name ?? target.index

    if (index === undefined) return null

    const slot = this.#slots.slot(target.file, index, target.occurrence ?? 0)

    return slot?.type === "collection" ? slot : null
  }

  #realKey(payload: Payload, temp: string): string | null {
    for (const value of Object.values(payload.slots)) {
      if (typeof value !== "object" || value === null || !("items" in value)) continue

      const keys = Object.keys((value as Collected).items).filter((key) => key !== temp)

      if (keys.length === 1) return keys[0]
    }

    return null
  }

  #narrow(payload: Payload, slot: Slot): Payload {
    const value = payload.slots[slot.index]

    if (value === undefined) return payload

    return { ...payload, slots: { [slot.index]: value } }
  }

  #request(options: SubmitOptions): MutationRequest {
    const headers: Record<string, string> = {
      Accept: "application/vnd.herb.slots+json",
      ...this.#options.headers?.(),
    }

    const token = typeof document === "undefined" ? null : document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content

    if (token && !headers["X-CSRF-Token"]) headers["X-CSRF-Token"] = token

    return {
      url: options.url,
      method: (options.method ?? "post").toUpperCase(),
      body: options.body,
      headers,
    }
  }

  #transport(): MutationTransport {
    return this.#options.transport ?? defaultTransport(this.#options.format ?? "slots")
  }
}

function defaultTransport(format: string): MutationTransport {
  return async (request, signal) => {
    const url = new URL(request.url, window.location.href)

    url.searchParams.set("format", format)

    const body =
      request.body instanceof FormData ? request.body : request.body ? new URLSearchParams(request.body) : undefined

    const response = await fetch(url.toString(), {
      method: request.method,
      body,
      headers: request.headers,
      signal,
    })

    if (!response.ok) throw new Error(`Herb mutation failed with ${response.status}`)

    return (await response.json()) as Payload
  }
}
