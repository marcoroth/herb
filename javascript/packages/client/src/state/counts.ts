import { scopeOf } from "./scopes"
import { matches } from "./conditions"
import { declaredValue } from "./declarations"

import type { Slots } from "../slots/slots"
import type { StateValue } from "./values"
import type { Region, Slot } from "../types"
import type { DeclaredState, StateBucket, StateChange, StateManifest, StateScope } from "./types"

export interface CountsDelegate {
  manifestFor(region: Region): StateManifest | null
  valueAt(name: string, scope: StateScope): StateValue
  derivedDependents(manifest: StateManifest, scope: StateScope, written: string[]): string[]
  countsChanged(manifest: StateManifest, scope: StateScope, changes: StateChange[]): void
}

export class Counts {
  private delegate: CountsDelegate
  private slots: Slots

  private queued = new Set<Region>()
  private last = new WeakMap<Region, StateBucket>()

  constructor(delegate: CountsDelegate, slots: Slots) {
    this.delegate = delegate
    this.slots = slots
  }

  declarationsIn(manifest: StateManifest): DeclaredState[] {
    return manifest.declarations.filter((declaration) => declaration.count)
  }

  countFor(declaration: DeclaredState, scope: StateScope): StateValue {
    const count = declaration.count

    if (count === undefined || count === null) {
      return null
    }

    const base = declaredValue(declaration)
    const slot = scope.region.slots.get(count.collection)

    let start = 0

    if (typeof base === "number") {
      start = base
    }

    if (!slot) {
      return start
    }

    const items = slot.items

    let counted = 0

    for (const item of items.values()) {
      const itemScope = scopeOf(scope.region, item)

      if (count.when === null || count.when === undefined || matches(count.when, (name) => this.delegate.valueAt(name, itemScope))) {
        counted += 1
      }
    }

    return start + counted * (count.by ?? 1)
  }

  itemsChanged(slot: Slot): void {
    const region = this.slots.regionOf(slot)

    if (!region) {
      return
    }

    const manifest = this.delegate.manifestFor(region)

    if (!manifest) {
      return
    }

    if (!this.declarationsIn(manifest).some((declaration) => declaration.count?.collection === slot.index)) {
      return
    }

    if (this.queued.has(region)) {
      return
    }

    this.queued.add(region)

    queueMicrotask(() => {
      this.queued.delete(region)
      this.recount(region)
    })
  }

  private recount(region: Region): void {
    const manifest = this.delegate.manifestFor(region)

    if (!manifest) {
      return
    }

    const regionScope = scopeOf(region)
    const changed: StateChange[] = []

    for (const declaration of this.declarationsIn(manifest)) {
      const previous = this.last.get(region)?.get(declaration.name) ?? null
      const value = this.delegate.valueAt(declaration.name, regionScope)

      if (value === previous) {
        continue
      }

      changed.push({ name: declaration.name, value, previous })
    }

    if (changed.length === 0) {
      return
    }

    const cascade = this.delegate.derivedDependents(manifest, regionScope, changed.map((entry) => entry.name))
      .map((name) => ({ name, previous: this.last.get(region)?.get(name) ?? null, value: this.delegate.valueAt(name, regionScope) }))
      .filter((entry) => entry.value !== entry.previous)

    const cache: StateBucket = this.last.get(region) ?? new Map()

    for (const entry of [...changed, ...cascade]) {
      cache.set(entry.name, entry.value)
    }

    this.last.set(region, cache)

    this.delegate.countsChanged(manifest, regionScope, [...changed, ...cascade])
  }
}
