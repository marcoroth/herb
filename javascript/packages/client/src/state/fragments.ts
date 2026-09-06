import { scopeOf } from "./scopes"
import { hostOf } from "../markup/anchors"

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
  requestRefetch(): void
  resettle(slot: Slot): void
}

export class Fragments {
  private readonly slots: Slots
  private readonly delegate: FragmentsDelegate
  private readonly showing = new Map<Slot, FragmentPresentation>()
  private readonly armed = new Set<Slot>()
  private readonly observers = new Map<Slot, IntersectionObserver>()

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
          this.delegate.resettle(slot)
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
          this.slots.switchBranch(slot, restored)
        }
      }, remaining)

      this.slots.switchBranch(slot, presentation.fallback)
    }
  }

  holding(slot: Slot): boolean {
    return (this.showing.get(slot)?.shownAt ?? 0) > 0
  }

  hydrated(): void {
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
          this.arm(placed.slot, entry, placed.scope)
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

    if (delay <= 0) {
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

    if (slot.branch !== presentation.fallback) {
      this.slots.switchBranch(slot, presentation.fallback)
    }
  }

  private arm(slot: Slot, entry: FragmentEntry, scope: StateScope): void {
    if (this.armed.has(slot)) {
      return
    }

    this.armed.add(slot)

    if (slot.branch !== entry.fallback) {
      return
    }

    const state = entry.state as string

    if (entry.mode === "async" || typeof IntersectionObserver === "undefined") {
      this.present(slot, entry)
      this.delegate.writeInternal(state, scope)
      this.delegate.requestRefetch()

      return
    }

    const sentinel = this.sentinelFor(slot)

    if (!sentinel) {
      this.delegate.writeInternal(state, scope)

      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return
      }

      observer.disconnect()
      this.observers.delete(slot)
      this.present(slot, entry)
      this.delegate.writeInternal(state, scope)
      this.delegate.requestRefetch()
    })

    observer.observe(sentinel)
    this.observers.set(slot, observer)
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
