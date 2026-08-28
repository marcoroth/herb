import { elementOf } from "../markup/anchors"

import type { Slots } from "../slots/slots"
import type { ApplyReport, Payload, Slot } from "../types"
import type { DependencyMap, ResolvedStateOptions, SerializedState, StateReport, StateRequest, StateSlot, StateWaiter } from "./types"

interface OptimisticWrite {
  slot: Slot
  value: string
}

const IDLE: StateReport = { applied: 0, deferred: [], written: 0, restored: 0, stale: false, failed: false }

export class ServerState {
  private readonly slots: Slots
  private readonly options: ResolvedStateOptions
  private readonly values = new Map<string, string>()
  private readonly dependencies = new Map<string, StateSlot[]>()
  private readonly params = new Map<string, string>()
  private readonly sequence = new Map<string, number>()

  private pending = new Map<string, string>()
  private restores: OptimisticWrite[] = []
  private previous = new Map<string, string | undefined>()
  private waiting: StateWaiter[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private controller: AbortController | null = null

  constructor(slots: Slots, options: ResolvedStateOptions) {
    this.slots = slots
    this.options = options
  }

  get(key: string): string | undefined {
    return this.values.get(key)
  }

  all(): SerializedState {
    return Object.fromEntries(this.values)
  }

  names(): string[] {
    return [...this.dependencies.keys()]
  }

  slotsFor(key: string): StateSlot[] {
    return this.dependencies.get(this.stateName(key)) ?? []
  }

  adopt(map: DependencyMap): void {
    for (const [name, slots] of Object.entries(map.state ?? {})) {
      this.dependencies.set(name, slots)
    }

    for (const [request, name] of Object.entries(map.params ?? {})) {
      this.params.set(request, name)
    }
  }

  known(name: string): boolean {
    return this.params.has(name) || this.dependencies.has(name)
  }

  set(key: string | SerializedState, value?: string): Promise<StateReport> {
    let changes: SerializedState = key as SerializedState

    if (typeof key === "string") {
      changes = { [key]: value ?? "" }
    }

    const changed = Object.keys(changes)

    for (const [name, next] of Object.entries(changes)) {
      this.pending.set(name, next)
      this.sequence.set(name, (this.sequence.get(name) ?? 0) + 1)

      if (!this.previous.has(name)) {
        this.previous.set(name, this.values.get(name))
      }

      this.values.set(name, next)
    }

    this.restores.push(...this.optimistic(changed))

    if (this.options.debounce <= 0) {
      return this.flush()
    }

    if (this.timer) {
      clearTimeout(this.timer)
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve)
      this.timer = setTimeout(() => {
        this.timer = null
        void this.flush()
      }, this.options.debounce)
    })
  }

  private async flush(): Promise<StateReport> {
    const changes = this.pending
    const restores = this.restores
    const previous = this.previous

    this.pending = new Map()
    this.restores = []
    this.previous = new Map()

    if (changes.size === 0) {
      return this.settle(IDLE)
    }

    const changed = [...changes.keys()]
    const taken = new Map(changed.map((name) => [name, this.sequence.get(name) ?? 0]))

    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller

    let payload: Payload | null = null

    try {
      payload = await this.options.transport({ state: this.all(), changed }, controller.signal)
    } catch (error) {
      if (controller.signal.aborted || this.superseded(taken)) {
        return this.settle({ ...IDLE, written: restores.length, stale: true })
      }

      this.restore(restores)

      for (const [name, was] of previous) {
        if (was === undefined) {
          this.values.delete(name)
        } else {
          this.values.set(name, was)
        }
      }

      return this.settle({ ...IDLE, written: restores.length, restored: restores.length, failed: true })
    }

    if (this.superseded(taken)) {
      return this.settle({ ...IDLE, written: restores.length, stale: true })
    }

    let report: ApplyReport = { applied: 0, deferred: [] }

    if (payload) {
      report = this.slots.apply(payload)
    }

    return this.settle({ ...report, written: restores.length, restored: 0, stale: false, failed: false })
  }

  private settle(report: StateReport): StateReport {
    const waiting = this.waiting

    this.waiting = []

    for (const resolve of waiting) {
      resolve(report)
    }

    return report
  }

  private superseded(taken: Map<string, number>): boolean {
    for (const [name, sequence] of taken) {
      if ((this.sequence.get(name) ?? 0) !== sequence) {
        return true
      }
    }

    return false
  }

  private optimistic(changed: string[]): OptimisticWrite[] {
    const restores: OptimisticWrite[] = []

    for (const name of changed) {
      const value = this.values.get(name) ?? ""

      for (const entry of this.dependencies.get(this.stateName(name)) ?? []) {
        for (const slot of this.resolve(entry)) {
          const was = this.slots.currentText(slot)

          if (this.writeSlot(slot, value)) {
            restores.push({ slot, value: was })
          }
        }
      }
    }

    return restores
  }

  private restore(restores: OptimisticWrite[]): void {
    for (const restore of [...restores].reverse()) {
      this.writeSlot(restore.slot, restore.value)
    }
  }

  private resolve(entry: StateSlot): Slot[] {
    const slots: Slot[] = []

    for (const region of this.slots.regionsFor(entry.file)) {
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

  async fetch(request: StateRequest, signal: AbortSignal): Promise<Payload | null> {
    const url = new URL(window.location.href)

    for (const [name, value] of Object.entries(request.state)) {
      url.searchParams.set(name, value)
    }

    url.searchParams.set("format", this.options.format)

    const response = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } })

    if (!response.ok) {
      throw new Error(`Herb state request failed with ${response.status}`)
    }

    return (await response.json()) as Payload
  }

  stateName(name: string): string {
    return this.params.get(name) ?? name
  }

  private writeSlot(slot: Slot, value: string): boolean {
    if (elementOf(slot.anchor) && slot.attribute) {
      return this.slots.setAttribute(slot, value)
    }

    return this.slots.setText(slot, value)
  }
}
