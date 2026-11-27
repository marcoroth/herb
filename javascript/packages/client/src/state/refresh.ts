import { armOf } from "./conditions"
import { slotsRequest } from "../shared/slots-request"
import { transitionMutation } from "../shared/transitions"

import type { Slots } from "../slots/slots"
import type { Payload, Region } from "../types"
import type { ComboCondition, RefreshTransport, StateCondition, StateManifest } from "./types"

export interface RefreshDelegate {
  manifestFor(region: Region): StateManifest | null
  steeringValue(region: Region, name: string): unknown
}

export interface RefreshOptions {
  transport?: RefreshTransport
  format?: string
}

export interface RefreshReport {
  applied: number
  deferred: number
  stale: boolean
  failed: boolean
}

type RefreshWaiter = (report: RefreshReport) => void

const HEADER_BUDGET = 4096

const OCCURRENCES_KEY = "@occurrences"

export class Refresh {
  private slots: Slots
  private delegate: RefreshDelegate
  private options: RefreshOptions
  private timer: ReturnType<typeof setTimeout> | null = null
  private due = Infinity
  private epoch = 0
  private controller: AbortController | null = null
  private waiting: RefreshWaiter[] = []

  constructor(slots: Slots, delegate: RefreshDelegate, options: RefreshOptions = {}) {
    this.slots = slots
    this.delegate = delegate
    this.options = options
  }

  request(delay = 0): Promise<RefreshReport> {
    const promise = new Promise<RefreshReport>((resolve) => this.waiting.push(resolve))
    const at = Date.now() + delay

    if (this.timer === null || at < this.due) {
      if (this.timer !== null) {
        clearTimeout(this.timer)
      }

      this.due = at
      this.timer = setTimeout(() => void this.run(), delay)
    }

    return promise
  }

  flush(): Promise<RefreshReport> {
    return this.request(0)
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)

      this.timer = null
    }

    this.due = Infinity
    this.controller?.abort()
    this.settle({ applied: 0, deferred: 0, stale: true, failed: false }, this.waiting.splice(0))
  }

  private async run(): Promise<void> {
    this.timer = null
    this.due = Infinity

    this.controller?.abort()

    const controller = new AbortController()
    const epoch = (this.epoch += 1)
    const waiting = this.waiting.splice(0)

    this.controller = controller

    let payload: Payload

    try {
      payload = await this.transport()(this.steering(), controller.signal)
    } catch {
      const stale = epoch !== this.epoch || controller.signal.aborted

      this.settle({ applied: 0, deferred: 0, stale, failed: !stale }, waiting)

      return
    }

    if (epoch !== this.epoch) {
      this.settle({ applied: 0, deferred: 0, stale: true, failed: false }, waiting)

      return
    }

    let report!: ReturnType<Slots["apply"]>

    await transitionMutation(() => {
      report = this.slots.apply(payload)
    })

    this.settle({ applied: report.applied, deferred: report.deferred.length, stale: false, failed: false }, waiting)
  }

  private settle(report: RefreshReport, waiting: RefreshWaiter[]): void {
    for (const waiter of waiting) {
      waiter(report)
    }
  }

  private transport(): RefreshTransport {
    if (this.options.transport) {
      return this.options.transport
    }

    return (state, signal) => slotsRequest(window.location.href, { format: this.options.format, state, signal })
  }

  private steering(): Record<string, Record<string, unknown>> {
    return steeringFor(this.slots.regions(), this.delegate)
  }
}

export function steeringFor(regions: Region[], delegate: RefreshDelegate): Record<string, Record<string, unknown>> {
  const steering: Record<string, Record<string, unknown>> = {}
  const budget = { left: HEADER_BUDGET }

  for (const region of regions) {
    const manifest = delegate.manifestFor(region)

    if (!manifest) {
      continue
    }

    const values: Record<string, unknown> = {}

    for (const name of steeringNames(manifest)) {
      const value = delegate.steeringValue(region, name)

      if (value !== undefined) {
        values[name] = value
      }
    }

    const base = steering[region.file]

    if (!base) {
      const taken = withinBudget(values, budget)

      if (Object.keys(taken).length > 0) {
        steering[region.file] = taken
      }

      continue
    }

    const differences = withinBudget(differencesFrom(base, values), budget)

    if (Object.keys(differences).length === 0) {
      continue
    }

    const occurrences = (base[OCCURRENCES_KEY] ??= {}) as Record<string, Record<string, unknown>>

    occurrences[region.occurrence] = differences
  }

  return steering
}

function differencesFrom(base: Record<string, unknown>, values: Record<string, unknown>): Record<string, unknown> {
  const differences: Record<string, unknown> = {}

  for (const [name, value] of Object.entries(values)) {
    if (!(name in base) || base[name] !== value) {
      differences[name] = value
    }
  }

  return differences
}

function withinBudget(values: Record<string, unknown>, budget: { left: number }): Record<string, unknown> {
  const taken: Record<string, unknown> = {}

  for (const [name, value] of Object.entries(values)) {
    const cost = name.length + JSON.stringify(value ?? null).length + 8

    if (cost > budget.left) {
      continue
    }

    budget.left -= cost
    taken[name] = value
  }

  return taken
}

export function steeringNames(manifest: StateManifest): Set<string> {
  const names = new Set<string>()

  for (const conditional of Object.values(manifest.conditionals ?? {})) {
    for (const entry of conditional.arms) {
      collectNames(armOf(entry).condition, names)
    }
  }

  for (const name of Object.keys(manifest.server?.reads ?? {})) {
    names.add(name)
  }

  const writable = new Set<string>()

  for (const declaration of manifest.declarations) {
    if (declaration.scope === "region" && !declaration.derived && !declaration.count) {
      writable.add(declaration.name)
    }
  }

  return new Set([...names].filter((name) => writable.has(name)))
}

function collectNames(condition: StateCondition, names: Set<string>): void {
  if (Array.isArray(condition)) {
    if (typeof condition[0] === "string") {
      names.add(condition[0])
    }

    const comparand = condition[1]

    if (comparand && typeof comparand === "object" && "state" in comparand && typeof comparand.state === "string") {
      names.add(comparand.state)
    }

    return
  }

  for (const part of partsOf(condition)) {
    collectNames(part, names)
  }
}

function partsOf(combo: ComboCondition): StateCondition[] {
  return combo.all ?? combo.any ?? []
}
