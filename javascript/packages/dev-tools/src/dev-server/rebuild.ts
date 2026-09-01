import { parseMarker, regionCloseMarker, regionOpenMarker } from "@herb-tools/client"
import { captureUserState, restoreUserState } from "./user-state"

import type { Region, Runtime, Slot, StateManifest } from "@herb-tools/client"

export interface RebuildOptions {
  region: Region
  version: string
  staticMarkup: string
  remap?: Record<string, number | null> | null
  stateOwned?: Set<number>
}

export interface RebuildResult {
  region: Region
  restored: number
  dropped: number[]
}

const HERB_MARKER_COMMENT = /<!--\/?herb-[^>]*-->/g

function capturable(slot: Slot): boolean {
  if (slot.type === "conditional" || slot.type === "collection" || slot.type === "block") {
    return false
  }

  return slot.attribute !== null || slot.anchor.kind !== "element"
}

function capturedMarkup(runtime: Runtime, slot: Slot): string {
  const holder = document.createElement("div")

  holder.append(runtime.slots.rangeOf(slot).cloneContents())

  return holder.innerHTML.replace(HERB_MARKER_COMMENT, "")
}

function captureValues(runtime: Runtime, region: Region): Map<number, { attribute: string | null; value: string }> {
  const values = new Map<number, { attribute: string | null; value: string }>()

  for (const [index, slot] of region.slots) {
    if (!capturable(slot)) {
      continue
    }

    const value = slot.attribute ? runtime.slots.currentText(slot) : capturedMarkup(runtime, slot)

    values.set(index, { attribute: slot.attribute, value })
  }

  return values
}

export function rebuildRegion(runtime: Runtime, options: RebuildOptions): RebuildResult | null {
  const { region, version, staticMarkup, remap } = options

  if (region.ranges.length !== 1) {
    return null
  }

  const range = region.ranges[0]

  if (!range.end || !range.start.isConnected || !range.end.isConnected) {
    return null
  }

  const marker = parseMarker(range.start.data)

  if (marker?.kind !== "region-open") {
    return null
  }

  const values = captureValues(runtime, region)
  const span = document.createRange()

  span.setStartBefore(range.start)
  span.setEndAfter(range.end)

  const userState = captureUserState(span, stateBoundControls(region, options.stateOwned))
  const holder = document.createElement("template")

  holder.innerHTML = `<!--${regionOpenMarker(marker.file, version, marker.occurrence)}-->${staticMarkup}<!--${regionCloseMarker(marker.file)}-->`

  const added = [...holder.content.childNodes]

  span.deleteContents()
  runtime.slots.prune()
  span.insertNode(holder.content)
  runtime.slots.scan(added)

  const rebuilt = runtime.slots.regionsFor(region.file).find((candidate) => candidate.occurrence === region.occurrence && candidate.version === version)

  if (!rebuilt) {
    return null
  }

  const changed = changedDeclarations(
    runtime.slots.statesFor(region.file, region.version),
    runtime.slots.statesFor(region.file, version)
  )

  if (typeof runtime.state.migrateRegion === "function") {
    runtime.state.migrateRegion(region, rebuilt, { except: changed })
  }

  const dropped: number[] = []
  let restored = 0

  for (const [oldIndex, captured] of values) {
    const mapped = remap ? (remap[String(oldIndex)] ?? null) : oldIndex
    const target = mapped === null ? undefined : rebuilt.slots.get(mapped)

    if (mapped === null || !target) {
      dropped.push(oldIndex)
      continue
    }

    if (options.stateOwned?.has(mapped)) {
      continue
    }

    if (captured.attribute) {
      runtime.slots.setAttribute(target, captured.value)
    } else {
      runtime.slots.update(target, captured.value)
    }

    restored += 1
  }

  resetChangedDeclarations(runtime, rebuilt, changed)

  if (typeof runtime.state.resettle === "function") {
    runtime.state.resettle(rebuilt)
  }

  const settled = document.createRange()

  settled.setStartBefore(rebuilt.ranges[0].start)
  settled.setEndAfter(rebuilt.ranges[0].end ?? rebuilt.ranges[0].start)

  restoreUserState(settled, userState)

  return { region: rebuilt, restored, dropped }
}

function resetChangedDeclarations(runtime: Runtime, region: Region, changed: string[]): void {
  if (changed.length === 0 || typeof runtime.state.reset !== "function") {
    return
  }

  const manifest = runtime.slots.statesFor(region.file, region.version)

  for (const name of changed) {
    const declaration = manifest?.declarations.find((candidate) => candidate.name === name)

    if (!declaration || declaration.derived || declaration.count) {
      continue
    }

    if (declaration.scope === "region") {
      runtime.state.reset(name, { scope: { region, item: null } })

      continue
    }

    for (const slot of region.slots.values()) {
      for (const item of slot.items.values()) {
        runtime.state.reset(name, { scope: { region, item } })
      }
    }
  }
}

function stateBoundControls(region: Region, stateOwned: Set<number> | undefined): Set<Element> {
  const bound = new Set<Element>()

  if (!stateOwned) {
    return bound
  }

  for (const [index, slot] of region.slots) {
    if (!stateOwned.has(index) || !slot.attribute) {
      continue
    }

    if (slot.attribute !== "value" && slot.attribute !== "checked") {
      continue
    }

    if (slot.anchor.kind === "element" || slot.anchor.kind === "content") {
      bound.add(slot.anchor.element)
    }
  }

  return bound
}

export function changedDeclarations(before: StateManifest | null, after: StateManifest | null): string[] {
  if (!before || !after) {
    return []
  }

  const meaning = ({ line: _line, column: _column, ...rest }: StateManifest["declarations"][number]) => JSON.stringify(rest)

  const previous = new Map(before.declarations.map((declaration) => [declaration.name, meaning(declaration)]))
  const names = new Set<string>()

  for (const declaration of after.declarations) {
    if (previous.get(declaration.name) !== meaning(declaration)) {
      names.add(declaration.name)
    }

    previous.delete(declaration.name)
  }

  for (const name of previous.keys()) {
    names.add(name)
  }

  return [...names]
}

export function stateOwnedIndices(states: Partial<StateManifest> | null | undefined): Set<number> {
  const owned = new Set<number>()

  if (!states) {
    return owned
  }

  for (const indices of Object.values(states.reads ?? {})) {
    for (const index of indices) {
      owned.add(index)
    }
  }

  for (const key of [...Object.keys(states.conditionals ?? {}), ...Object.keys(states.presence ?? {}), ...Object.keys(states.computed ?? {})]) {
    owned.add(Number(key))
  }

  return owned
}
