import { SLOT_EVENT } from "./slot-index"

import type { ApplyReport, Payload, Slot, SlotEventDetail, SlotIndex } from "./slot-index"

const VALUE_ELEMENTS = ["INPUT", "TEXTAREA", "SELECT"]

export const DEPENDENCIES_ATTRIBUTE = "data-herb-dependencies"
export const DEPENDENCIES_SELECTOR = `template[${DEPENDENCIES_ATTRIBUTE}]`

export type StateMode = "identity" | "structural" | "derived"
export type StatePersistence = "url" | "known" | "none"

export interface StateSlot {
  file: string
  version: string
  index: number
  mode: StateMode
}

export interface DependencyMap {
  state: Record<string, StateSlot[]>
  params?: Record<string, string>
}

export interface StateRequest {
  state: Record<string, string>
  changed: string[]
}

export type StateTransport = (request: StateRequest, signal: AbortSignal) => Promise<Payload | null>

export interface StateOptions {
  transport?: StateTransport
  debounce?: number
  persist?: StatePersistence
  format?: string
}

export interface StateReport extends ApplyReport {
  written: number
  restored: number
  stale: boolean
  failed: boolean
}

interface Restore {
  slot: Slot
  value: string
}

const IDLE: StateReport = { applied: 0, deferred: [], written: 0, restored: 0, stale: false, failed: false }

export class SlotState {
  readonly #slots: SlotIndex
  readonly #values = new Map<string, string>()
  readonly #dependencies = new Map<string, StateSlot[]>()
  readonly #params = new Map<string, string>()
  readonly #sequence = new Map<string, number>()
  readonly #options: Required<Omit<StateOptions, "transport">> & { transport: StateTransport }

  #pending = new Map<string, string>()
  #restores: Restore[] = []
  #previous = new Map<string, string | undefined>()
  #waiting: ((report: StateReport) => void)[] = []
  #timer: ReturnType<typeof setTimeout> | null = null
  #controller: AbortController | null = null
  #observer: MutationObserver | null = null

  constructor(slots: SlotIndex, options: StateOptions = {}) {
    this.#slots = slots
    this.#options = {
      transport: options.transport ?? this.#fetch.bind(this),
      debounce: options.debounce ?? 0,
      persist: options.persist ?? "url",
      format: options.format ?? "slots",
    }

    if (this.#persisted()) this.#readLocation()
  }

  #persisted(): boolean {
    return this.#options.persist !== "none"
  }

  #known(name: string): boolean {
    return this.#params.has(name) || this.#dependencies.has(name)
  }

  #transient(name: string): boolean {
    return this.#options.persist === "known" && !this.#known(name)
  }

  #forget(names: string[]): void {
    for (const name of names) this.#values.delete(name)
  }

  get(key: string): string | undefined {
    return this.#values.get(key)
  }

  all(): Record<string, string> {
    return Object.fromEntries(this.#values)
  }

  names(): string[] {
    return [...this.#dependencies.keys()]
  }

  slotsFor(key: string): StateSlot[] {
    return this.#dependencies.get(this.#stateName(key)) ?? []
  }

  #stateName(name: string): string {
    return this.#params.get(name) ?? name
  }

  adopt(root: ParentNode = document): number {
    const templates = [...root.querySelectorAll<HTMLTemplateElement>(DEPENDENCIES_SELECTOR)]

    for (const template of templates) {
      this.#merge(template.content.textContent ?? template.textContent ?? "")
      template.remove()
    }

    return templates.length
  }

  observe(root: Node = document.documentElement): void {
    if (typeof document === "undefined") return

    document.addEventListener(SLOT_EVENT, this.#syncProperty)

    if (typeof window !== "undefined" && this.#persisted()) {
      window.addEventListener("popstate", this.#onPopState)
    }

    this.#observer?.disconnect()
    this.#observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches(DEPENDENCIES_SELECTOR) || node.querySelector(DEPENDENCIES_SELECTOR)) {
            this.adopt()

            return
          }
        }
      }
    })

    this.#observer.observe(root, { childList: true, subtree: true })
  }

  disconnect(): void {
    this.#observer?.disconnect()
    this.#observer = null

    if (typeof document === "undefined") return

    document.removeEventListener(SLOT_EVENT, this.#syncProperty)

    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.#onPopState)
    }
  }

  set(key: string | Record<string, string>, value?: string): Promise<StateReport> {
    const changes = typeof key === "string" ? { [key]: value ?? "" } : key
    const changed = Object.keys(changes)

    for (const [name, next] of Object.entries(changes)) {
      this.#pending.set(name, next)
      this.#sequence.set(name, (this.#sequence.get(name) ?? 0) + 1)

      if (!this.#previous.has(name)) this.#previous.set(name, this.#values.get(name))

      this.#values.set(name, next)
    }

    this.#restores.push(...this.#optimistic(changed))

    if (this.#options.debounce <= 0) return this.#flush()

    if (this.#timer) clearTimeout(this.#timer)

    return new Promise((resolve) => {
      this.#waiting.push(resolve)
      this.#timer = setTimeout(() => {
        this.#timer = null
        void this.#flush()
      }, this.#options.debounce)
    })
  }

  async #flush(): Promise<StateReport> {
    const changes = this.#pending
    const restores = this.#restores
    const previous = this.#previous

    this.#pending = new Map()
    this.#restores = []
    this.#previous = new Map()

    if (changes.size === 0) return this.#settle(IDLE)

    const changed = [...changes.keys()]
    const taken = new Map(changed.map((name) => [name, this.#sequence.get(name) ?? 0]))
    const transient = [...this.#values.keys()].filter((name) => this.#transient(name))

    this.#controller?.abort()
    this.#controller = new AbortController()

    let payload: Payload | null = null

    try {
      payload = await this.#options.transport({ state: this.all(), changed }, this.#controller.signal)
    } catch (error) {
      this.#forget(transient)

      if (this.#superseded(taken)) return this.#settle({ ...IDLE, written: restores.length, stale: true })

      this.#restore(restores)

      for (const [name, was] of previous) {
        if (was === undefined) this.#values.delete(name)
        else this.#values.set(name, was)
      }

      return this.#settle({ ...IDLE, written: restores.length, restored: restores.length, failed: true })
    }

    this.#forget(transient)

    if (this.#superseded(taken)) return this.#settle({ ...IDLE, written: restores.length, stale: true })

    const report = payload ? this.#slots.apply(payload) : { applied: 0, deferred: [] }

    if (this.#persisted()) this.#writeLocation()

    return this.#settle({ ...report, written: restores.length, restored: 0, stale: false, failed: false })
  }

  #settle(report: StateReport): StateReport {
    const waiting = this.#waiting

    this.#waiting = []

    for (const resolve of waiting) resolve(report)

    return report
  }

  #superseded(taken: Map<string, number>): boolean {
    for (const [name, sequence] of taken) {
      if ((this.#sequence.get(name) ?? 0) !== sequence) return true
    }

    return false
  }

  #optimistic(changed: string[]): Restore[] {
    const restores: Restore[] = []

    for (const name of changed) {
      const value = this.#values.get(name) ?? ""

      for (const entry of this.#dependencies.get(this.#stateName(name)) ?? []) {
        if (entry.mode !== "identity") continue

        for (const slot of this.#resolve(entry)) {
          const was = this.#slots.currentText(slot)

          if (this.#write(slot, value)) restores.push({ slot, value: was })
        }
      }
    }

    return restores
  }

  #restore(restores: Restore[]): void {
    for (const restore of [...restores].reverse()) this.#write(restore.slot, restore.value)
  }

  #write(slot: Slot, value: string): boolean {
    if (slot.anchor.kind !== "range" && slot.attribute) {
      return this.#slots.setAttribute(slot, value)
    }

    return this.#slots.setText(slot, value)
  }

  #resolve(entry: StateSlot): Slot[] {
    const slots: Slot[] = []

    for (const region of this.#slots.regionsFor(entry.file)) {
      if (region.version !== entry.version) continue

      const slot = region.slots.get(entry.index)

      if (slot) slots.push(slot)
    }

    return slots
  }

  #merge(json: string): void {
    if (!json.trim()) return

    let map: DependencyMap

    try {
      map = JSON.parse(json) as DependencyMap
    } catch {
      return
    }

    for (const [name, slots] of Object.entries(map.state ?? {})) {
      this.#dependencies.set(name, slots)
    }

    for (const [request, name] of Object.entries(map.params ?? {})) {
      this.#params.set(request, name)
    }
  }

  #readLocation(): void {
    if (typeof window === "undefined") return

    this.#values.clear()

    for (const [name, value] of new URL(window.location.href).searchParams) {
      if (name !== "format") this.#values.set(name, value)
    }
  }

  #writeLocation(): void {
    if (typeof window === "undefined" || !window.history?.replaceState) return

    const url = new URL(window.location.href)

    url.search = ""

    for (const [name, value] of this.#values) {
      if (this.#options.persist === "known" && !this.#known(name)) continue

      url.searchParams.set(name, value)
    }

    window.history.replaceState(window.history.state, "", url.toString())
  }

  #onPopState = (): void => {
    this.#readLocation()
  }

  #syncProperty = (event: Event): void => {
    const detail = (event as CustomEvent<SlotEventDetail>).detail

    if (detail.operation !== "attribute") return

    const slot = detail.slot

    if (!slot || slot.anchor.kind === "range" || slot.attribute !== "value") return

    const element = slot.anchor.element

    if (!VALUE_ELEMENTS.includes(element.tagName)) return

    const written = element.getAttribute("value") ?? ""

    if ((element as HTMLInputElement).value !== written) {
      ;(element as HTMLInputElement).value = written
    }
  }

  async #fetch(request: StateRequest, signal: AbortSignal): Promise<Payload | null> {
    const url = new URL(window.location.href)

    url.search = ""

    for (const [name, value] of Object.entries(request.state)) url.searchParams.set(name, value)

    url.searchParams.set("format", this.#options.format)

    const response = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } })

    if (!response.ok) throw new Error(`Herb state request failed with ${response.status}`)

    return (await response.json()) as Payload
  }
}
