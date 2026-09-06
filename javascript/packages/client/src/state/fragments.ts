import { scopeOf } from "./scopes"
import { connected, hostOf } from "../markup/anchors"
import { transitionMutation } from "../shared/transitions"

import type { Slots } from "../slots/slots"
import type { RefreshReport } from "./refresh"
import type { Region, Slot } from "../types"
import type { FragmentEntry, PlacedSlot, StateManifest, StateScope } from "./types"

const FRAGMENT_DELAY = 150
const FRAGMENT_HOLD = 300

interface FragmentPresentation {
  fallback: number
  hold: number
  deferred: boolean
  shownAt: number
  showTimer: ReturnType<typeof setTimeout> | null
  restoreTimer: ReturnType<typeof setTimeout> | null
}

export interface FragmentsDelegate {
  manifestFor(region: Region): StateManifest | null
  placedSlots(scope: StateScope, index: number): PlacedSlot[]
  writeInternal(name: string, scope: StateScope): void
  requestBlock(region: Region, index: number): Promise<RefreshReport>
  resettle(slot: Slot): void
}

export class Fragments {
  private readonly slots: Slots
  private readonly delegate: FragmentsDelegate
  private readonly showing = new Map<Slot, FragmentPresentation>()
  private readonly armed = new Set<Slot>()
  private readonly observers = new Map<Slot, IntersectionObserver>()
  private readonly polls = new Map<Slot, ReturnType<typeof setTimeout>>()

  constructor(slots: Slots, delegate: FragmentsDelegate) {
    this.slots = slots
    this.delegate = delegate
  }

  showFallbacks(manifest: StateManifest, scope: StateScope, stale: Set<number>, names: string[] = []): void {
    const entries = Object.entries(manifest.fragments ?? {}).sort(([left], [right]) => Number(left) - Number(right))

    for (const [key, fragment] of entries) {
      if (!fragment.reads?.some((index) => stale.has(index))) {
        continue
      }

      if (fragment.on && !fragment.on.some((name) => names.includes(name))) {
        continue
      }

      for (const placed of this.delegate.placedSlots(scope, Number(key))) {
        this.present(placed.slot, fragment)
      }
    }
  }

  settle(outcome: RefreshReport): void {
    if (outcome.stale) {
      return
    }

    for (const [slot, presentation] of this.showing) {
      if (presentation.restoreTimer !== null) {
        continue
      }

      if (presentation.showTimer !== null) {
        clearTimeout(presentation.showTimer)

        presentation.showTimer = null
      }

      if (presentation.shownAt === 0 || outcome.failed) {
        this.showing.delete(slot)

        continue
      }

      const remaining = presentation.shownAt + presentation.hold - Date.now()

      if (slot.branch === presentation.fallback) {
        if (!presentation.deferred) {
          this.showing.delete(slot)

          continue
        }

        presentation.restoreTimer = setTimeout(() => {
          this.showing.delete(slot)

          void transitionMutation(() => this.delegate.resettle(slot), hostOf(slot.anchor) ?? document)
        }, Math.max(remaining, 0))

        continue
      }

      if (remaining <= 0) {
        this.showing.delete(slot)

        continue
      }

      const restored = slot.branch

      presentation.restoreTimer = setTimeout(() => {
        this.showing.delete(slot)

        if (slot.branch === presentation.fallback) {
          void transitionMutation(() => void this.slots.switchBranch(slot, restored), hostOf(slot.anchor) ?? document)
        }
      }, remaining)

      if (this.slots.switchBranch(slot, presentation.fallback)) {
        this.delegate.resettle(slot)
      }
    }
  }

  holding(slot: Slot): boolean {
    return (this.showing.get(slot)?.shownAt ?? 0) > 0
  }

  hydrated(): void {
    this.sweep()

    for (const region of this.slots.regions()) {
      const fragments = this.delegate.manifestFor(region)?.fragments

      if (!fragments) {
        continue
      }

      const scope = scopeOf(region)

      for (const [key, entry] of Object.entries(fragments)) {
        if (!entry.mode || !entry.state) {
          continue
        }

        for (const placed of this.delegate.placedSlots(scope, Number(key))) {
          this.arm(placed.slot, Number(key), entry, placed.scope)
        }
      }
    }
  }

  disconnect(): void {
    for (const presentation of this.showing.values()) {
      if (presentation.showTimer !== null) {
        clearTimeout(presentation.showTimer)
      }

      if (presentation.restoreTimer !== null) {
        clearTimeout(presentation.restoreTimer)
      }
    }

    this.showing.clear()

    for (const observer of this.observers.values()) {
      observer.disconnect()
    }

    this.observers.clear()
    this.armed.clear()

    for (const timer of this.polls.values()) {
      clearTimeout(timer)
    }

    this.polls.clear()
  }

  private sweep(): void {
    for (const [slot, timer] of this.polls) {
      if (!connected(slot.anchor)) {
        clearTimeout(timer)
        this.polls.delete(slot)
      }
    }

    for (const [slot, observer] of this.observers) {
      if (!connected(slot.anchor)) {
        observer.disconnect()
        this.observers.delete(slot)
      }
    }

    for (const slot of this.armed) {
      if (!connected(slot.anchor)) {
        this.armed.delete(slot)
      }
    }
  }

  private present(slot: Slot, fragment: FragmentEntry): void {
    const existing = this.showing.get(slot)

    if (existing) {
      if (existing.restoreTimer !== null) {
        clearTimeout(existing.restoreTimer)

        existing.restoreTimer = null
      }

      return
    }

    const presentation: FragmentPresentation = {
      fallback: fragment.fallback,
      hold: fragment.hold ?? FRAGMENT_HOLD,
      deferred: Boolean(fragment.mode),
      shownAt: 0,
      showTimer: null,
      restoreTimer: null,
    }

    this.showing.set(slot, presentation)

    const delay = fragment.delay ?? FRAGMENT_DELAY

    if (delay <= 0 || slot.branch === presentation.fallback) {
      this.swapToFallback(slot, presentation)

      return
    }

    presentation.showTimer = setTimeout(() => {
      presentation.showTimer = null

      this.swapToFallback(slot, presentation)
    }, delay)
  }

  private swapToFallback(slot: Slot, presentation: FragmentPresentation): void {
    presentation.shownAt = Date.now()

    if (presentation.deferred) {
      this.slots.claim(slot)
    }

    if (slot.branch !== presentation.fallback && this.slots.switchBranch(slot, presentation.fallback)) {
      this.delegate.resettle(slot)
    }
  }

  private arm(slot: Slot, index: number, entry: FragmentEntry, scope: StateScope): void {
    if (this.armed.has(slot)) {
      return
    }

    this.armed.add(slot)

    if (slot.branch !== entry.fallback) {
      this.armPoll(slot, index, entry, scope)

      return
    }

    if (entry.mode === "async" || typeof IntersectionObserver === "undefined") {
      this.trigger(slot, index, entry, scope)

      return
    }

    const sentinel = this.sentinelFor(slot)

    if (!sentinel) {
      this.trigger(slot, index, entry, scope)

      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return
      }

      observer.disconnect()
      this.observers.delete(slot)
      this.trigger(slot, index, entry, scope)
    })

    observer.observe(sentinel)
    this.observers.set(slot, observer)
  }

  private trigger(slot: Slot, index: number, entry: FragmentEntry, scope: StateScope): void {
    this.present(slot, entry)
    this.delegate.writeInternal(entry.state as string, scope)

    void this.delegate.requestBlock(scope.region, index).then((outcome) => {
      this.settle(outcome)
      this.armPoll(slot, index, entry, scope)
    })
  }

  private armPoll(slot: Slot, index: number, entry: FragmentEntry, scope: StateScope): void {
    const every = entry.poll ?? 0

    if (every <= 0 || this.polls.has(slot)) {
      return
    }

    const tick = (): void => {
      this.polls.set(slot, setTimeout(() => {
        if (!connected(slot.anchor)) {
          this.polls.delete(slot)
          this.armed.delete(slot)

          return
        }

        if (document.hidden) {
          tick()

          return
        }

        void this.delegate.requestBlock(scope.region, index).then((outcome) => {
          this.settle(outcome)

          if (this.polls.has(slot)) {
            tick()
          }
        })
      }, every))
    }

    tick()
  }

  private sentinelFor(slot: Slot): Element | null {
    const anchor = slot.anchor

    if (anchor.kind === "range") {
      let node: Node | null = anchor.start.nextSibling

      while (node && node !== anchor.end) {
        if (node instanceof Element) {
          return node
        }

        node = node.nextSibling
      }
    }

    return hostOf(anchor)
  }
}
