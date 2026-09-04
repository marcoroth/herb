import { descendantsOf, link } from "./tree"
import { asList, last, popMatching } from "../shared/arrays"
import { numericBranch, parseMarker } from "../markup/markers"
import { anchorEntries, anchorKind, connected, markers, withinBounds, withinRegion, withinRegionRange } from "../markup/anchors"

import type { Statics } from "./statics"
import type { Manifests } from "./manifests"
import type { Item, ItemMap, ParseState, Placement, Region, RegionRange, ScanContext, ScanResult, Slot, SlotAddress, SlotMap } from "../types"
import type { BranchMarker, ItemCloseMarker, ItemOpenMarker, MarkerData, RegionCloseMarker, RegionOpenMarker, SeedsMarker, SlotCloseMarker, SlotOpenMarker } from "../markup/markers"

function depth(state: ParseState): string {
  return `${state.openRegions.length}:${state.openSlots.length}:${state.openItems.length}`
}

function rangeAround(region: Region, node: Node): RegionRange | null {
  return region.ranges.find((range) => withinRegionRange(range, node)) ?? null
}

export interface RegionIndexDelegate {
  pruneItems(slot: Slot): void
}

export class RegionIndex {
  private delegate: RegionIndexDelegate
  private statics: Statics
  private manifests: Manifests
  private held: Region[] = []
  private visited = new WeakSet<Node>()

  constructor(delegate: RegionIndexDelegate, statics: Statics, manifests: Manifests) {
    this.delegate = delegate
    this.statics = statics
    this.manifests = manifests
  }

  scan(roots: Node | Node[], context?: ScanContext): ScanResult {
    const result: ScanResult = { regions: [], slots: [] }
    const list = asList(roots)

    let state: ParseState | null = null
    let seeded = ""

    for (const root of list) {
      if (!state || depth(state) === seeded) {
        state = this.seed(context ?? this.locate(root) ?? {})
        seeded = depth(state)
      }

      this.scanMarkers(root, result, state)
    }

    for (const root of list) {
      this.manifests.adopt(root)
      this.statics.adopt(root)
    }

    return result
  }

  locate(node: Node): Placement | null {
    return this.placements(node)[0] ?? null
  }

  placements(node: Node): Placement[] {
    const found: Placement[] = []

    for (const region of this.held) {
      if (!withinRegion(region, node)) {
        continue
      }

      found.push(this.placementIn(region, node))
    }

    return found.sort((left, right) => {
      const leftStart = rangeAround(left.region, node)!.start
      const rightStart = rangeAround(right.region, node)!.start

      if (leftStart === rightStart) {
        return 0
      }

      if (leftStart.compareDocumentPosition(rightStart) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return 1
      }

      return -1
    })
  }

  private seed(context: ScanContext): ParseState {
    const state: ParseState = { openRegions: [], openSlots: [], openItems: [] }
    const region = context.region ?? context.slot?.region ?? context.item?.collection.region ?? null

    if (region) {
      const range = context.slot ? rangeAround(region, context.slot.anchor.kind === "range" ? context.slot.anchor.start : context.slot.anchor.element) : region.ranges[0]

      state.openRegions.push({ region, range: range ?? region.ranges[0] })
    }

    if (context.item) {
      state.openItems.push({ slot: context.item.collection.index, item: context.item })
    }

    if (context.slot) {
      state.openSlots.push({ index: context.slot.index, slot: context.slot })
    }

    return state
  }

  regionsFor(file: string): Region[] {
    return this.held.filter((region) => region.file === file)
  }

  regions(): Region[] {
    return [...this.held]
  }

  files(): string[] {
    return [...new Set(this.held.map((region) => region.file))]
  }

  slotsFor(file: string, index: number): Slot[] {
    return this.regionsFor(file).map((region) => region.slots.get(index)).filter((slot): slot is Slot => slot !== undefined)
  }

  region(file: string, occurrence = 0): Region | null {
    return this.regionsFor(file).find((region) => region.occurrence === occurrence) ?? null
  }

  slot(file: string, index: number | string, occurrence = 0): Slot | null {
    const region = this.region(file, occurrence)

    if (!region) {
      return null
    }

    const resolved = this.slotIndex(region, index, null)

    if (resolved === null) {
      return null
    }

    return region.slots.get(resolved) ?? null
  }

  itemsFor(file: string, index: number | string, occurrence = 0): ItemMap {
    return this.slot(file, index, occurrence)?.items ?? new Map()
  }

  slotInItem(file: string, collection: number | string, key: string, index: number | string, occurrence = 0): Slot | null {
    const region = this.region(file, occurrence)
    const item = this.itemsFor(file, collection, occurrence).get(key)

    if (!region || !item) {
      return null
    }

    const resolved = this.slotIndex(region, index, item)

    if (resolved === null) {
      return null
    }

    return item.slots.get(resolved) ?? null
  }

  private slotIndex(region: Region, index: number | string, item: Item | null): number | null {
    if (typeof index === "number") {
      return index
    }

    const named = this.manifests.nameOf(region.file, region.version, index)

    if (named !== null) {
      return named
    }

    const owner = item?.slots ?? region.slots

    for (const slot of owner.values()) {
      if (slot.attribute === index) {
        return slot.index
      }
    }

    return null
  }

  regionOf(slot: Slot): Region {
    return slot.region
  }

  slotAt(address: SlotAddress): Slot | null {
    let owner = address.region.slots

    for (const step of address.path) {
      const items = owner.get(step.collection)?.items.get(step.key)

      if (!items) {
        return null
      }

      owner = items.slots
    }

    return owner.get(address.index) ?? null
  }

  private owner(slot: Slot): SlotMap {
    return slot.item?.slots ?? slot.region.slots
  }

  prune(): number {
    const before = this.held.length

    this.held = this.held.filter((region) => this.regionConnected(region))

    for (const region of this.held) {
      for (const [index, slot] of region.slots) {
        if (this.slotConnected(slot)) {
          this.delegate.pruneItems(slot)
        } else {
          region.slots.delete(index)
        }
      }
    }

    return before - this.held.length
  }

  clear(): void {
    this.held = []
    this.visited = new WeakSet()
    this.statics.clear()
    this.manifests.clear()
  }

  get size(): number {
    return this.held.reduce((total, region) => total + region.slots.size, 0)
  }

  private scanMarkers(root: Node, result: ScanResult, state: ParseState): void {
    for (const marker of markers(root)) {
      if (marker.nodeType === Node.ELEMENT_NODE) {
        const element = marker as Element

        if (this.visited.has(element)) {
          continue
        }

        this.visited.add(element)

        this.anchorSlots(element, result, state)

        continue
      }

      const comment = marker as Comment
      const parsed = parseMarker(comment.data.trim())

      if (!parsed) {
        continue
      }

      if (this.visited.has(comment)) {
        this.replay(parsed, comment, state)

        continue
      }

      this.visited.add(comment)

      switch (parsed.kind) {
        case "region-open": {
          this.openRegion(parsed, comment, result, state)

          break
        }

        case "region-close": {
          this.closeRegion(parsed, comment, state)

          break
        }

        case "slot-open": {
          this.openSlot(parsed, comment, result, state)

          break
        }

        case "slot-close": {
          this.closeSlot(parsed, comment, state)

          break
        }

        case "item-open": {
          this.openItem(parsed, comment, state)

          break
        }

        case "item-close": {
          this.closeItem(parsed, comment, state)

          break
        }

        case "seeds": {
          this.sowSeeds(parsed, state)

          break
        }

        case "branch": {
          this.markBranch(parsed, state)

          break
        }
      }
    }
  }

  private replay(marker: MarkerData, comment: Comment, state: ParseState): void {
    switch (marker.kind) {
      case "region-open": {
        const region = this.held.find((candidate) => candidate.file === marker.file && candidate.occurrence === marker.occurrence && candidate.version === marker.version)
        const range = region?.ranges.find((candidate) => candidate.start === comment)

        if (region && range) {
          state.openRegions.push({ region, range })
        }

        break
      }

      case "region-close": {
        popMatching(state.openRegions, (candidate) => candidate.region.file === marker.file)
        break
      }

      case "slot-open": {
        const slot = this.holderAt(state)?.slots.get(marker.index)

        if (slot && slot.anchor.kind === "range" && slot.anchor.start === comment) {
          state.openSlots.push({ index: slot.index, slot })
        }

        break
      }

      case "slot-close": {
        popMatching(state.openSlots, (candidate) => candidate.index === marker.index)

        break
      }

      case "item-open": {
        const collection = this.collectionAt(state, marker.index)
        const item = collection?.items.get(marker.key)

        if (item && item.start === comment) {
          state.openItems.push({ slot: marker.index, item })
        }

        break
      }

      case "item-close": {
        popMatching(state.openItems, (candidate) => candidate.slot === marker.index)

        break
      }

      case "seeds": {
        break
      }

      case "branch": {
        break
      }
    }
  }

  // A held region only continues into new markup while it still stands in
  // the page. A body swap, the way a Turbo visit replaces a page, delivers
  // the fresh markup before the removal, so matching an already detached
  // region here would alias the new page onto the old visit's slots.
  private openRegion(marker: RegionOpenMarker, comment: Comment, result: ScanResult, state: ParseState): void {
    const range: RegionRange = { start: comment, end: null }
    const existing = this.held.find((candidate) => candidate.file === marker.file && candidate.occurrence === marker.occurrence && candidate.version === marker.version)

    if (existing && existing.ranges.some((candidate) => candidate.start.isConnected)) {
      existing.ranges.push(range)
      state.openRegions.push({ region: existing, range })

      return
    }

    if (existing) {
      this.held = this.held.filter((candidate) => candidate !== existing)
    }

    const region: Region = {
      file: marker.file,
      version: marker.version,
      occurrence: marker.occurrence,
      ranges: [range],
      slots: new Map(),
    }

    state.openRegions.push({ region, range })

    this.held.push(region)
    result.regions.push(region)
  }

  private closeRegion(marker: RegionCloseMarker, comment: Comment, state: ParseState): void {
    const open = popMatching(state.openRegions, (candidate) => candidate.region.file === marker.file)

    if (!open) {
      return
    }

    open.range.end = comment
  }

  private openSlot(marker: SlotOpenMarker, comment: Comment, result: ScanResult, state: ParseState): void {
    const region = this.regionAt(state)

    if (!region) {
      return
    }

    const item = this.itemAt(state, region)
    const enclosing = this.slotOpenIn(state, region)

    const slot: Slot = {
      index: marker.index,
      type: marker.type,
      attribute: null,
      anchor: { kind: "range", start: comment, end: comment },
      items: new Map(),
      branch: null,
      parent: null,
      children: [],
      region,
      item,
      claimed: false,
      shown: null,
      captured: null,
    }

    state.openSlots.push({ index: slot.index, slot })

    this.attach(region, slot, result, enclosing, item)
  }

  private closeSlot(marker: SlotCloseMarker, comment: Comment, state: ParseState): void {
    const open = popMatching(state.openSlots, (candidate) => candidate.index === marker.index)

    if (open?.slot.anchor.kind === "range") {
      open.slot.anchor.end = comment
    }
  }

  private openItem(marker: ItemOpenMarker, comment: Comment, state: ParseState): void {
    const collection = this.collectionAt(state, marker.index)

    if (!collection) {
      return
    }

    const item: Item = { key: marker.key, start: comment, end: comment, slots: new Map(), collection }

    collection.items.set(item.key, item)

    state.openItems.push({ slot: marker.index, item })
  }

  private closeItem(marker: ItemCloseMarker, comment: Comment, state: ParseState): void {
    const open = popMatching(state.openItems, (candidate) => candidate.slot === marker.index)

    if (open) {
      open.item.end = comment
    }
  }

  private sowSeeds(marker: SeedsMarker, state: ParseState): void {
    const holder = this.holderAt(state)

    if (!holder) {
      return
    }

    holder.seeds = { ...(holder.seeds ?? {}), ...marker.seeds }
  }

  private markBranch(marker: BranchMarker, state: ParseState): void {
    const region = this.regionAt(state)
    const branch = numericBranch(marker.branch)

    if (branch === null || !region) {
      return
    }

    const stacked = state.openSlots.find((candidate) => candidate.index === marker.index && candidate.slot.region === region)?.slot
    const slot = stacked ?? this.holderAt(state)?.slots.get(marker.index)

    if (slot) {
      slot.branch = branch
    }
  }

  private regionAt(state: ParseState): Region | null {
    return last(state.openRegions)?.region ?? null
  }

  private holderAt(state: ParseState): Region | Item | null {
    const region = this.regionAt(state)

    if (!region) {
      return null
    }

    return this.itemAt(state, region) ?? region
  }

  private collectionAt(state: ParseState, index: number): Slot | null {
    const region = this.regionAt(state)

    if (!region) {
      return null
    }

    const stacked = state.openSlots.find((candidate) => candidate.index === index && candidate.slot.region === region)?.slot

    if (stacked) {
      return stacked
    }

    return this.holderAt(state)?.slots.get(index) ?? null
  }

  private slotOpenIn(state: ParseState, region: Region): Slot | null {
    const stacked = last(state.openSlots)?.slot ?? null

    if (stacked && stacked.region === region) {
      return stacked
    }

    return null
  }

  private itemAt(state: ParseState, region: Region): Item | null {
    const opened = last(state.openItems)?.item ?? null

    if (opened && opened.collection.region === region) {
      return opened
    }

    return null
  }

  private anchorSlots(element: Element, result: ScanResult, state: ParseState): void {
    const region = this.regionAt(state)

    if (!region) {
      return
    }

    const enclosing = this.slotOpenIn(state, region)
    const item = this.itemAt(state, region)

    for (const entry of anchorEntries(element)) {
      const slot: Slot = {
        index: entry.index,
        type: entry.type,
        attribute: entry.attribute,
        anchor: { kind: anchorKind(entry.type), element },
        items: new Map(),
        branch: null,
        parent: null,
        children: [],
        region,
        item,
        claimed: false,
        shown: null,
        captured: null,
      }

      this.attach(region, slot, result, enclosing, item)
    }
  }

  private attach(region: Region | null, slot: Slot, result: ScanResult, parent: Slot | null = null, item: Item | null = null): void {
    if (!region) {
      return
    }

    const target = item?.slots ?? region.slots
    const existing = target.get(slot.index)

    if (existing) {
      existing.anchor = slot.anchor
      existing.type = slot.type

      link(parent, existing)

      return
    }

    link(parent, slot)

    target.set(slot.index, slot)

    result.slots.push(slot)
  }

  forget(slot: Slot): void {
    const owner = this.owner(slot)

    if (owner.get(slot.index) === slot) {
      owner.delete(slot.index)
    }

    if (slot.parent) {
      slot.parent.children = slot.parent.children.filter((child) => child !== slot)
    }
  }

  forgetChildren(slot: Slot): void {
    for (const descendant of descendantsOf(slot)) {
      this.forget(descendant)
    }

    slot.children = []
  }

  private placementIn(region: Region, node: Node): Placement {
    let slots: SlotMap = region.slots
    let slot: Slot | null = null
    let item: Item | null = null

    for (;;) {
      let inner: Slot | null = null
      let holder: Item | null = null

      for (const candidate of slots.values()) {
        if (candidate.anchor.kind !== "range" || !withinBounds(candidate.anchor, node)) {
          continue
        }

        if (!inner || (inner.anchor.kind === "range" && withinBounds(inner.anchor, candidate.anchor.start))) {
          inner = candidate
        }

        for (const held of candidate.items.values()) {
          if (!withinBounds(held, node)) {
            continue
          }

          if (!holder || withinBounds(holder, held.start)) {
            holder = held
          }
        }
      }

      if (inner) {
        slot = inner
      }

      if (!holder) {
        return { region, slot, item }
      }

      item = holder
      slots = holder.slots
    }
  }

  private regionConnected(region: Region): boolean {
    region.ranges = region.ranges.filter((range) => range.start.isConnected)

    return region.ranges.length > 0
  }

  private slotConnected(slot: Slot): boolean {
    return connected(slot.anchor)
  }
}
