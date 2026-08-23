/**
 * The state a page asks the server for.
 *
 * A page sets a state, the slots that state reaches are written with the new value straight away,
 * and the server is asked what the template renders now. What comes back is applied over the
 * optimistic writes, and a request that fails or is overtaken puts them back. The values live in
 * the URL, so a reload and a back button land on the same page.
 */

import { elementOf } from "./anchors"

import type { SlotIndex } from "./slot-index"
import type { ApplyReport, Payload, Slot } from "./types"
import type { DependencyMap, ResolvedStateOptions, SerializedState, StateReport, StateRequest, StateSlot, StateWaiter } from "./state"

interface OptimisticWrite {
  slot: Slot
  value: string
}

const IDLE: StateReport = { applied: 0, deferred: [], written: 0, restored: 0, stale: false, failed: false }

export class ServerState {
  readonly #slots: SlotIndex
  readonly #options: ResolvedStateOptions
  readonly #values = new Map<string, string>()
  readonly #dependencies = new Map<string, StateSlot[]>()
  readonly #params = new Map<string, string>()
  readonly #writtenParams = new Set<string>()
  readonly #sequence = new Map<string, number>()

  #pending = new Map<string, string>()
  #restores: OptimisticWrite[] = []
  #previous = new Map<string, string | undefined>()
  #waiting: StateWaiter[] = []
  #timer: ReturnType<typeof setTimeout> | null = null
  #controller: AbortController | null = null

  constructor(slots: SlotIndex, options: ResolvedStateOptions) {
    this.#slots = slots
    this.#options = options

    if (this.persisted()) {
      this.readLocation()
    }
  }

  get(key: string): string | undefined {
    return this.#values.get(key)
  }

  all(): SerializedState {
    return Object.fromEntries(this.#values)
  }

  names(): string[] {
    return [...this.#dependencies.keys()]
  }

  slotsFor(key: string): StateSlot[] {
    return this.#dependencies.get(this.stateName(key)) ?? []
  }

  // What the page was told about the states a template reads, which is what says a name is one
  // the page knows and which slots it may write itself.
  adopt(map: DependencyMap): void {
    for (const [name, slots] of Object.entries(map.state ?? {})) {
      this.#dependencies.set(name, slots)
    }

    for (const [request, name] of Object.entries(map.params ?? {})) {
      this.#params.set(request, name)
    }
  }

  known(name: string): boolean {
    return this.#params.has(name) || this.#dependencies.has(name)
  }

  set(key: string | SerializedState, value?: string): Promise<StateReport> {
    let changes: SerializedState = key as SerializedState

    if (typeof key === "string") {
      changes = { [key]: value ?? "" }
    }

    const changed = Object.keys(changes)

    for (const [name, next] of Object.entries(changes)) {
      this.#pending.set(name, next)
      this.#sequence.set(name, (this.#sequence.get(name) ?? 0) + 1)

      if (!this.#previous.has(name)) {
        this.#previous.set(name, this.#values.get(name))
      }

      this.#values.set(name, next)
    }

    this.#restores.push(...this.#optimistic(changed))

    if (this.#options.debounce <= 0) {
      return this.#flush()
    }

    if (this.#timer) {
      clearTimeout(this.#timer)
    }

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

    if (changes.size === 0) {
      return this.#settle(IDLE)
    }

    const changed = [...changes.keys()]
    const taken = new Map(changed.map((name) => [name, this.#sequence.get(name) ?? 0]))
    const transient = [...this.#values.keys()].filter((name) => this.#transient(name))

    this.#controller?.abort()
    const controller = new AbortController()
    this.#controller = controller

    let payload: Payload | null = null

    try {
      payload = await this.#options.transport({ state: this.all(), changed }, controller.signal)
    } catch (error) {
      this.#forget(transient)

      if (controller.signal.aborted || this.#superseded(taken)) {
        return this.#settle({ ...IDLE, written: restores.length, stale: true })
      }

      this.#restore(restores)

      for (const [name, was] of previous) {
        if (was === undefined) {
          this.#values.delete(name)
        } else {
          this.#values.set(name, was)
        }
      }

      return this.#settle({ ...IDLE, written: restores.length, restored: restores.length, failed: true })
    }

    this.#forget(transient)

    if (this.#superseded(taken)) {
      return this.#settle({ ...IDLE, written: restores.length, stale: true })
    }

    let report: ApplyReport = { applied: 0, deferred: [] }

    if (payload) {
      report = this.#slots.apply(payload)
    }

    if (this.persisted()) {
      this.writeLocation()
    }

    return this.#settle({ ...report, written: restores.length, restored: 0, stale: false, failed: false })
  }

  #settle(report: StateReport): StateReport {
    const waiting = this.#waiting

    this.#waiting = []

    for (const resolve of waiting) {
      resolve(report)
    }

    return report
  }

  #superseded(taken: Map<string, number>): boolean {
    for (const [name, sequence] of taken) {
      if ((this.#sequence.get(name) ?? 0) !== sequence) {
        return true
      }
    }

    return false
  }

  #optimistic(changed: string[]): OptimisticWrite[] {
    const restores: OptimisticWrite[] = []

    for (const name of changed) {
      const value = this.#values.get(name) ?? ""

      for (const entry of this.#dependencies.get(this.stateName(name)) ?? []) {
        for (const slot of this.#resolve(entry)) {
          const was = this.#slots.currentText(slot)

          if (this.#writeSlot(slot, value)) {
            restores.push({ slot, value: was })
          }
        }
      }
    }

    return restores
  }

  #restore(restores: OptimisticWrite[]): void {
    for (const restore of [...restores].reverse()) {
      this.#writeSlot(restore.slot, restore.value)
    }
  }

  #resolve(entry: StateSlot): Slot[] {
    const slots: Slot[] = []

    for (const region of this.#slots.regionsFor(entry.file)) {
      if (region.version !== entry.version) {
        continue
      }

      const slot = region.slots.get(entry.index)

      if (slot) {
        slots.push(slot)
      }
    }

    return slots
  }

  readLocation(): void {
    if (typeof window === "undefined") {
      return
    }

    this.#values.clear()

    for (const [name, value] of new URL(window.location.href).searchParams) {
      if (name !== "format") {
        this.#values.set(name, value)
      }
    }
  }

  writeLocation(): void {
    if (typeof window === "undefined" || !window.history?.replaceState) {
      return
    }

    const url = new URL(window.location.href)

    for (const name of this.#writtenParams) {
      url.searchParams.delete(name)
    }

    this.#writtenParams.clear()

    for (const [name, value] of this.#values) {
      if (this.#options.persist === "known" && !this.known(name)) {
        continue
      }

      url.searchParams.set(name, value)
      this.#writtenParams.add(name)
    }

    window.history.replaceState(window.history.state, "", url.toString())
  }

  async fetch(request: StateRequest, signal: AbortSignal): Promise<Payload | null> {
    const url = new URL(window.location.href)

    for (const [name, value] of Object.entries(request.state)) {
      url.searchParams.set(name, value)
    }

    url.searchParams.set("format", this.#options.format)

    const response = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } })

    if (!response.ok) {
      throw new Error(`Herb state request failed with ${response.status}`)
    }

    return (await response.json()) as Payload
  }

  #transient(name: string): boolean {
    return this.#options.persist === "known" && !this.known(name)
  }

  #forget(names: string[]): void {
    for (const name of names) {
      this.#values.delete(name)
      this.#writtenParams.add(name)
    }
  }

  persisted(): boolean {
    return this.#options.persist !== "none"
  }

  stateName(name: string): string {
    return this.#params.get(name) ?? name
  }

  #writeSlot(slot: Slot, value: string): boolean {
    if (elementOf(slot.anchor) && slot.attribute) {
      return this.#slots.setAttribute(slot, value)
    }

    return this.#slots.setText(slot, value)
  }
}
