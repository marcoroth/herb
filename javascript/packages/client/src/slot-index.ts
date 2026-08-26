/**
 * An index over the slot markers `Herb::Engine::SlotVisitor` emits, so a client can find a
 * template's dynamic parts again after the page has rendered.
 *
 * Two properties of the markup drive the shape of this:
 *
 *   - A marker pair is not necessarily a pair of siblings. The HTML parser inserts a `<tbody>`
 *     into a `<table>` and moves the items into it, leaving the markers that preceded them
 *     behind, so an item's opening and closing marker can sit at different depths. Pairing is by
 *     index on a stack, never by walking siblings.
 *   - One template can be on the page many times, so a file maps to a list of regions rather
 *     than to one.
 *
 * Scanning is incremental. `scan` takes whatever subtree just arrived and adds what it finds,
 * attaching slots to an already-indexed region when the new markup landed inside one.
 *
 * The marker grammar lives in `markers.ts`, finding markers in a document in `anchors.ts`, and
 * filling or blanking a detached copy in `fragments.ts`.
 */

import { ElementObserver } from "./element-observer"

import type { ElementObserverDelegate } from "./element-observer"
import { ITEM_STATICS } from "./markers"

import { Manifests } from "./manifests"
import { Statics } from "./statics"

import { anchorEntries, anchorKind, connected, currentHTML, currentText, elementOf, htmlOf, innerRange, markers, outerRange, rangeOf as rangeOfAnchor, withinBounds, withinRegion, withinRegionRange } from "./anchors"
import { asList, last, popMatching } from "./arrays"
import { applyPayload } from "./apply"
import { ancestorsOf, descendantsOf, link } from "./slots"
import { branchKey, itemMarker, itemStaticsKey, numericBranch, parseMarker } from "./markers"
import { attributeNames, blankSlots, fillSlots, interpolateParts, withoutMarkers } from "./fragments"

import type { StateManifest } from "./state"
import type { TemplateManifest } from "./manifests"
import type { BranchMarker, ItemCloseMarker, ItemOpenMarker, MarkerData, RegionCloseMarker, RegionOpenMarker, SeedsMarker, SlotCloseMarker, SlotOpenMarker } from "./markers"
import type { AddItemOptions, AttributeParts, ApplyMode, BuildCause, Built, SlotListener, ApplyOptions, ApplyReport, Inverse, Item, ItemMap, ItemPlan, ItemStep, ItemValues, ParseState, PartsResolver, Payload, Placement, Region, RegionRange, ScanContext, RenderMode, Restore, RevertToken, ScanResult, Slot, SlotAddress, SlotEventDetail, SlotMap, SlotOperation, SlotValue, SlotValues, TransactionResult } from "./types"

export const SLOT_EVENT = "herb:slot-update"

const MAX_JOURNAL = 50
const NUMERIC_NAME = /^\d+$/

function depth(state: ParseState): string {
  return `${state.openRegions.length}:${state.openSlots.length}:${state.openItems.length}`
}

function rangeAround(region: Region, node: Node): RegionRange | null {
  return region.ranges.find((range) => withinRegionRange(range, node)) ?? null
}

export class SlotIndex implements ElementObserverDelegate {
  #regions: Region[] = []
  #visited = new WeakSet<Node>()
  #journal = new Map<RevertToken, Inverse[]>()
  #recording: Inverse[] | null = null
  #nextToken = 1
  #statics = new Statics()
  #manifests = new Manifests()
  #cause: BuildCause = "client"
  #built: Built | null = null
  #listeners = new Set<SlotListener>()
  #elements: ElementObserver | null = null
  #unobserve: (() => void) | null = null

  claim(slot: Slot): void {
    slot.claimed = true
  }

  observe(root: Node = document.documentElement, elements?: ElementObserver): ScanResult {
    this.#unobserve?.()

    this.#elements = elements ?? new ElementObserver()
    this.#unobserve = this.#elements.add(this)

    this.#elements.observe(root)

    return this.scan(root)
  }

  nodesAdded(nodes: Node[]): void {
    this.scan(nodes)
  }

  nodesRemoved(): void {
    this.prune()
  }

  disconnect(): void {
    this.#unobserve?.()
    this.#unobserve = null
    this.#elements = null
  }

  scan(roots: Node | Node[], context?: ScanContext): ScanResult {
    const result: ScanResult = { regions: [], slots: [] }
    const list = asList(roots)

    let state: ParseState | null = null
    let seeded = ""

    for (const root of list) {
      if (!state || depth(state) === seeded) {
        state = this.#seed(context ?? this.locate(root) ?? {})
        seeded = depth(state)
      }

      this.#scanMarkers(root, result, state)
    }

    for (const root of list) {
      this.#manifests.adopt(root)
      this.#statics.adopt(root)
    }

    return result
  }

  locate(node: Node): Placement | null {
    return this.placements(node)[0] ?? null
  }

  placements(node: Node): Placement[] {
    const found: Placement[] = []

    for (const region of this.#regions) {
      if (!withinRegion(region, node)) {
        continue
      }

      found.push(this.#placementIn(region, node))
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

  #seed(context: ScanContext): ParseState {
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
    return this.#regions.filter((region) => region.file === file)
  }

  regions(): Region[] {
    return [...this.#regions]
  }

  files(): string[] {
    return [...new Set(this.#regions.map((region) => region.file))]
  }

  slotsFor(file: string, index: number): Slot[] {
    return this.regionsFor(file)
      .map((region) => region.slots.get(index))
      .filter((slot): slot is Slot => slot !== undefined)
  }

  region(file: string, occurrence = 0): Region | null {
    return this.regionsFor(file).find((region) => region.occurrence === occurrence) ?? null
  }

  slot(file: string, index: number | string, occurrence = 0): Slot | null {
    const region = this.region(file, occurrence)

    if (!region) {
      return null
    }

    const resolved = this.#slotIndex(region, index, null)

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

    const resolved = this.#slotIndex(region, index, item)

    if (resolved === null) {
      return null
    }

    return item.slots.get(resolved) ?? null
  }

  #slotIndex(region: Region, index: number | string, item: Item | null): number | null {
    if (typeof index === "number") {
      return index
    }

    const named = this.#manifests.nameOf(region.file, region.version, index)

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

  adoptManifests(manifests: Record<string, TemplateManifest>): number {
    return this.#manifests.hold(manifests)
  }

  statesFor(file: string, version: string): StateManifest | null {
    return this.#manifests.statesOf(file, version)
  }

  rangeOf(target: Slot | Item): Range {
    return "anchor" in target ? rangeOfAnchor(target.anchor) : innerRange(target)
  }

  descendantsOf(slot: Slot): Slot[] {
    return descendantsOf(slot)
  }

  ancestorsOf(slot: Slot): Slot[] {
    return ancestorsOf(slot)
  }

  regionOf(slot: Slot): Region {
    return slot.region
  }

  reconcile(slot: Slot, keys: string[]): ItemPlan {
    const present = this.#itemsInDocumentOrder(slot).map((item) => item.key)
    const wanted = new Set(keys)

    const removed = present.filter((key) => !wanted.has(key))
    const added = keys.filter((key) => !present.includes(key))
    const kept = keys.filter((key) => present.includes(key))
    const order = present.filter((key) => wanted.has(key))
    const moved = kept.filter((key, position) => order[position] !== key)
    const unchanged = added.length === 0 && removed.length === 0 && moved.length === 0

    return { added, removed, moved, kept, unchanged }
  }

  apply(payload: Payload, options: ApplyOptions = {}): ApplyReport {
    return this.#building("apply", () => applyPayload(this, payload, options.items ?? "replace"))
  }

  subscribe(listener: SlotListener): () => void {
    this.#listeners.add(listener)

    return () => {
      this.#listeners.delete(listener)
    }
  }

  #building<T>(cause: BuildCause, work: () => T): T {
    if (this.#built) {
      return work()
    }

    const built: Built = { branches: [], items: [] }
    const previous = this.#cause

    this.#built = built
    this.#cause = cause

    try {
      return work()
    } finally {
      this.#built = null
      this.#cause = previous

      if (built.branches.length > 0 || built.items.length > 0) {
        this.#announceBuilt(built, cause)
      }
    }
  }

  transaction<T>(work: () => T): TransactionResult<T> {
    if (this.#recording) {
      return { token: null, result: work() }
    }

    const inverses: Inverse[] = []

    this.#recording = inverses

    let result: T

    try {
      result = work()
    } finally {
      this.#recording = null
    }

    if (inverses.length === 0) {
      return { token: null, result }
    }

    const token = this.#nextToken++

    this.#journal.set(token, inverses)

    if (this.#journal.size > MAX_JOURNAL) {
      const oldest = this.#journal.keys().next().value

      if (oldest !== undefined) {
        this.#journal.delete(oldest)
      }
    }

    return { token, result }
  }

  revert(token: RevertToken): boolean {
    const inverses = this.#journal.get(token)

    if (!inverses) {
      return false
    }

    this.#journal.delete(token)

    for (let position = inverses.length - 1; position >= 0; position -= 1) {
      inverses[position]()
    }

    return true
  }

  #recordSlot(slot: Slot, capture: () => Restore): void {
    if (!this.#recording) {
      return
    }

    const restore = capture()
    const address = this.#addressOf(slot)

    this.#recording.push(() => {
      const live = this.#slotAtAddress(address)

      if (live) {
        restore(live)
      }
    })
  }

  #addressOf(slot: Slot): SlotAddress {
    const path: ItemStep[] = []

    let item = slot.item

    while (item) {
      path.unshift({ collection: item.collection.index, key: item.key })

      item = item.collection.item
    }

    return { region: slot.region, path, index: slot.index }
  }

  #slotAtAddress(address: SlotAddress): Slot | null {
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

  #swapBranch(slot: Slot, branch: number | null, dynamics: SlotValues): boolean {
    this.#recordSlot(slot, () => {
      const before = this.#current(slot)
      const previous = slot.branch

      return (live) => {
        this.update(live, before)

        live.branch = previous
      }
    })

    this.capture(slot)

    if (branch === null) {
      this.update(slot, "")

      slot.branch = null

      return true
    }

    const markup = this.materialize(slot.region.file, branchKey(slot.index, branch), dynamics)

    if (!markup) {
      return false
    }

    this.#writeFragment(slot, markup)

    slot.branch = branch

    this.#built?.branches.push(slot)

    return true
  }

  #mergeItems(slot: Slot, wanted: string[]): string[] {
    const added = wanted.filter((key) => !slot.items.has(key))

    if (added.length === 0) {
      return []
    }

    const template = this.#rowTemplate(slot)
    const anchor = this.#itemsEnd(slot)

    if (!template || !anchor) {
      return added
    }

    for (const key of added) {
      this.#buildItem(slot, key, template, anchor)
    }

    return []
  }

  reconcileItems(slot: Slot, wanted: string[], mode: ApplyMode = "replace"): string[] {
    return this.#building("client", () => {
      if (mode === "merge") {
        return this.#mergeItems(slot, wanted)
      }

      const plan = this.reconcile(slot, wanted)

      return plan.unchanged ? [] : this.#reconcileItems(slot, wanted, plan)
    })
  }

  #reconcileItems(slot: Slot, wanted: string[], plan: ItemPlan): string[] {
    let template: DocumentFragment | null = null

    if (plan.added.length > 0) {
      template = this.#rowTemplate(slot)
    }

    for (const key of plan.removed) {
      const item = slot.items.get(key)

      if (item) {
        this.#dropItem(slot, item)
      }
    }

    if (!template) {
      this.#order(slot, wanted.filter((key) => slot.items.has(key)))

      return plan.added
    }

    for (const key of plan.added) {
      this.#buildItem(slot, key, template)
    }

    this.#order(slot, wanted)

    return []
  }

  #rowTemplate(slot: Slot): DocumentFragment | null {
    const statics = this.parked(slot.region.file, itemStaticsKey(slot.index))

    if (statics) {
      return statics
    }

    const [item] = this.#itemsInDocumentOrder(slot)

    if (!item) {
      return null
    }

    return this.#rowFragment(item)
  }

  #rowFragment(item: Item): DocumentFragment {
    const fragment = document.createRange().createContextualFragment("")

    fragment.append(outerRange(item).cloneContents())

    blankSlots(fragment)

    return fragment
  }

  #keepItem(slot: Slot, item: Item): void {
    if (slot.items.size > 1) {
      return
    }

    this.#statics.park(slot.region, itemStaticsKey(slot.index), this.#rowFragment(item))
  }

  #buildItem(slot: Slot, key: string, template: DocumentFragment, anchor?: Node | null, values: SlotValues = {}, text = false): void {
    const copy = template.cloneNode(true) as DocumentFragment

    for (const marker of markers(copy)) {
      if (marker.nodeType !== Node.COMMENT_NODE) {
        continue
      }

      const comment = marker as Comment
      const parsed = parseMarker(comment.data.trim())

      if (parsed?.kind === "item-open" && parsed.index === slot.index) {
        comment.data = itemMarker(slot.index, key)

        break
      }
    }

    for (const node of [...copy.childNodes]) {
      if (node.nodeType !== Node.COMMENT_NODE) {
        continue
      }

      const marker = parseMarker((node as Comment).data.trim())

      if (marker?.kind === "branch" && marker.branch === ITEM_STATICS) {
        node.remove()
      }
    }

    fillSlots(copy, values, text, this.#partsResolver(slot))

    const added = [...copy.childNodes]
    const target = this.#insertionPoint(slot, anchor)

    if (!target) {
      return
    }

    target.parentNode?.insertBefore(copy, target)

    this.scan(added, { region: slot.region, slot, item: slot.item })

    this.#recordSlot(slot, () => (live) => {
      const made = live.items.get(key)

      if (made) {
        this.#dropItem(live, made)
      }
    })

    const item = slot.items.get(key) ?? null

    if (item) {
      this.#built?.items.push({ slot, item })
    }

    this.#announce(slot, "item-added", slot.index, key, item)
  }

  #insertionPoint(slot: Slot, anchor?: Node | null): Node | null {
    if (anchor) {
      return anchor
    }

    const [first] = this.#itemsInDocumentOrder(slot)

    if (first) {
      return first.start
    }

    return this.#itemsEnd(slot)
  }

  #itemsEnd(slot: Slot): Comment | null {
    if (slot.anchor.kind !== "range") {
      return null
    }

    return slot.anchor.end
  }

  #partsFor(region: Region, index: number): AttributeParts | null {
    return this.#manifests.partsOf(region.file, region.version, index)
  }

  #partsResolver(slot: Slot): PartsResolver {
    return (index) => this.#partsFor(slot.region, index)
  }

  #dropItem(slot: Slot, item: Item): void {
    this.#recordSlot(slot, () => {
      const fragment = outerRange(item).cloneContents()
      const following = this.#itemsInDocumentOrder(slot)
      const nextKey = following[following.indexOf(item) + 1]?.key ?? null

      return (live) => {
        if (live.anchor.kind !== "range" || live.items.has(item.key)) {
          return
        }

        let target: Node = live.anchor.end

        if (nextKey !== null) {
          target = live.items.get(nextKey)?.start ?? live.anchor.end
        }

        const copy = fragment.cloneNode(true) as DocumentFragment
        const added = [...copy.childNodes]

        target.parentNode?.insertBefore(copy, target)

        this.scan(added, { region: live.region, slot: live, item: live.item })
        this.#announce(live, "item-added", live.index, item.key, live.items.get(item.key) ?? null)
      }
    })

    this.#keepItem(slot, item)
    this.#announce(slot, "item-removed", slot.index, item.key, item)

    outerRange(item).deleteContents()

    slot.items.delete(item.key)
  }

  #order(slot: Slot, keys: string[]): void {
    const end = this.#itemsEnd(slot)

    if (!end) {
      return
    }

    this.#recordSlot(slot, () => {
      const before = this.#itemsInDocumentOrder(slot).map((item) => item.key)

      return (live) => {
        this.#order(live, before)
      }
    })

    for (const key of keys) {
      const item = slot.items.get(key)

      if (!item) {
        continue
      }

      end.parentNode?.insertBefore(outerRange(item).extractContents(), end)
    }

    this.#pruneItems(slot)
  }

  #rewrite(range: Range, source: DocumentFragment, context: ScanContext): ScanResult {
    const added = [...source.childNodes]

    range.deleteContents()
    range.insertNode(source)

    return this.scan(added, context)
  }

  #writeFragment(slot: Slot, fragment: DocumentFragment): void {
    this.#forgetChildren(slot)
    this.#rewrite(this.rangeOf(slot), fragment, { region: slot.region, slot, item: slot.item })
    this.#announce(slot, "branch", slot.index)
  }

  #owner(slot: Slot): SlotMap {
    return slot.item?.slots ?? slot.region.slots
  }


  currentText(slot: Slot): string {
    return this.#attributeValue(slot) ?? currentText(slot.anchor)
  }

  setText(slot: Slot, text: string): boolean {
    if (slot.anchor.kind === "element") {
      return false
    }

    if (this.currentText(slot) === text) {
      return false
    }

    this.#recordSlot(slot, () => {
      const before = this.#current(slot)

      return (live) => {
        this.update(live, before)
      }
    })

    this.#forgetChildren(slot)

    if (slot.anchor.kind === "content") {
      slot.anchor.element.textContent = text
    } else {
      const fragment = document.createDocumentFragment()

      fragment.append(document.createTextNode(text))

      this.#rewrite(this.rangeOf(slot), fragment, { region: slot.region, slot, item: slot.item })
    }

    this.#announce(slot, "value", slot.index)

    return true
  }

  #attributeValue(slot: Slot): string | null {
    const element = elementOf(slot.anchor)

    if (!element || !slot.attribute) {
      return null
    }

    return element.getAttribute(slot.attribute) ?? ""
  }

  #current(slot: Slot): string {
    return currentHTML(slot.anchor)
  }

  covers(slot: Slot, value: SlotValue): boolean {
    if (Array.isArray(value)) {
      return false
    }

    return withoutMarkers(this.#current(slot)) === withoutMarkers(value)
  }

  holds(slot: Slot, value: SlotValue): boolean {
    if (slot.type === "attribute_interpolation") {
      const whole = this.#interpolate(slot, value)

      if (whole === null) {
        return false
      }

      return this.#attributeValue(slot) === whole
    }

    if (Array.isArray(value)) {
      return false
    }

    const attribute = this.#attributeValue(slot)

    if (attribute === null) {
      return this.#current(slot) === value
    }

    return attribute === value
  }

  #announce(slot: Slot | null, operation: SlotOperation, index: number, key: string | null = null, item: Item | null = null, previousKey: string | null = null): void {
    const region = slot?.region ?? null

    this.#notify({
      file: region?.file ?? "",
      occurrence: region?.occurrence ?? 0,
      index,
      operation,
      key,
      previousKey,
      slot,
      item,
      cause: this.#cause,
    })
  }

  #announceBuilt(built: Built, cause: BuildCause): void {
    const [slot] = built.branches.length > 0 ? built.branches : built.items.map((entry) => entry.slot)
    const region = slot?.region ?? null

    this.#notify({
      file: region?.file ?? "",
      occurrence: region?.occurrence ?? 0,
      index: slot?.index ?? 0,
      operation: "built",
      key: null,
      previousKey: null,
      slot: null,
      item: null,
      cause,
      built,
    })
  }

  #notify(detail: SlotEventDetail): void {
    for (const listener of [...this.#listeners]) {
      listener(detail)
    }

    if (typeof document === "undefined") {
      return
    }

    document.dispatchEvent(new CustomEvent<SlotEventDetail>(SLOT_EVENT, { detail }))
  }

  update(slot: Slot, html: string): ScanResult {
    if (this.#current(slot) === html) {
      return { regions: [], slots: [] }
    }

    this.#recordSlot(slot, () => {
      const before = this.#current(slot)

      return (live) => {
        this.update(live, before)
      }
    })

    this.#forgetChildren(slot)

    if (slot.anchor.kind === "element") {
      const replacement = this.rangeOf(slot).createContextualFragment(html)
      const element = slot.anchor.element
      const parent = element.parentNode

      element.replaceWith(replacement)
      this.#forget(slot)

      if (!parent) {
        return this.scan([])
      }

      return this.scan([...parent.childNodes], { region: slot.region, slot: slot.parent, item: slot.item })
    }

    const range = this.rangeOf(slot)
    const result = this.#rewrite(range, range.createContextualFragment(html), { region: slot.region, slot, item: slot.item })

    this.#announce(slot, "value", slot.index)

    return result
  }

  updateItem(slot: Slot, key: string, html: string): ScanResult | null {
    const item = slot.items.get(key)

    if (!item) {
      return null
    }

    this.#recordSlot(slot, () => {
      const before = htmlOf(this.rangeOf(item))

      return (live) => {
        this.updateItem(live, key, before)
      }
    })

    const range = this.rangeOf(item)
    const result = this.#rewrite(range, range.createContextualFragment(html), { region: slot.region, slot, item })

    this.#announce(slot, "item-updated", slot.index, key, slot.items.get(key) ?? null)

    return result
  }

  addItem(slot: Slot, key: string, options: AddItemOptions = {}): Item | null {
    if (slot.type !== "collection") {
      return null
    }

    const end = this.#itemsEnd(slot)

    if (!end || slot.items.has(key)) {
      return null
    }

    const template = this.#rowTemplate(slot)

    if (!template) {
      return null
    }

    let anchor = end

    if (options.before !== undefined) {
      anchor = slot.items.get(options.before)?.start ?? end
    }

    const values = this.#itemValues(slot, template, options.values ?? {})

    this.#building("client", () => {
      this.#buildItem(slot, key, template, anchor, values, options.text === true)
    })

    return slot.items.get(key) ?? null
  }

  removeItem(slot: Slot, key: string): boolean {
    const item = slot.items.get(key)

    if (!item) {
      return false
    }

    this.#dropItem(slot, item)

    return true
  }

  rekeyItem(slot: Slot, from: string, to: string): boolean {
    if (from === to || slot.items.has(to)) {
      return false
    }

    const item = slot.items.get(from)

    if (!item) {
      return false
    }

    item.start.data = itemMarker(slot.index, to)
    item.key = to

    slot.items.delete(from)
    slot.items.set(to, item)

    this.#recordSlot(slot, () => (live) => {
      this.rekeyItem(live, to, from)
    })

    this.#announce(slot, "item-rekeyed", slot.index, to, item, from)

    return true
  }

  #itemValues(slot: Slot, template: DocumentFragment, values: ItemValues): SlotValues {
    const attributes = attributeNames(template)
    const resolved: SlotValues = {}

    for (const [given, value] of Object.entries(values)) {
      if (NUMERIC_NAME.test(given)) {
        resolved[Number(given)] = value

        continue
      }

      const index = this.#manifests.nameOf(slot.region.file, slot.region.version, given) ?? attributes.get(given) ?? null

      if (index !== null) {
        resolved[index] = value
      }
    }

    return resolved
  }

  setAttribute(slot: Slot, value: SlotValue | null, name = slot.attribute): boolean {
    if (!elementOf(slot.anchor) || name === null) {
      return false
    }

    let written: SlotValue | null = value

    if (slot.type === "attribute_interpolation") {
      written = this.#interpolate(slot, value)

      if (written === null) {
        return false
      }
    }

    if (Array.isArray(written)) {
      return false
    }

    return this.#writeAttribute(slot, written, name)
  }

  #writeAttribute(slot: Slot, value: string | null, name: string): boolean {
    const element = elementOf(slot.anchor)

    if (!element) {
      return false
    }

    if (element.getAttribute(name) === value) {
      return true
    }

    this.#recordSlot(slot, () => {
      const before = element.getAttribute(name)

      return (live) => {
        this.#writeAttribute(live, before, name)
      }
    })

    if (value === null) {
      element.removeAttribute(name)
    } else {
      element.setAttribute(name, value)
    }

    this.#announce(slot, "attribute", slot.index)

    return true
  }

  setBooleanAttribute(slot: Slot, present: boolean, name = slot.attribute): boolean {
    const element = elementOf(slot.anchor)

    if (!element || name === null) {
      return false
    }

    if (slot.type !== "boolean_attribute") {
      return false
    }

    if (element.hasAttribute(name) === present) {
      return true
    }

    this.#recordSlot(slot, () => {
      const before = element.hasAttribute(name)

      return (live) => {
        this.setBooleanAttribute(live, before, name)
      }
    })

    element.toggleAttribute(name, present)

    if (name in element) {
      ;(element as unknown as Record<string, unknown>)[name] = present
    }

    this.#announce(slot, "attribute", slot.index)

    return true
  }

  #interpolate(slot: Slot, value: SlotValue | null): string | null {
    if (value === null) {
      return null
    }

    return interpolateParts(this.#partsFor(slot.region, slot.index), value)
  }

  capture(slot: Slot): boolean {
    if (slot.branch === null) {
      return false
    }

    return this.#statics.park(slot.region, branchKey(slot.index, slot.branch), this.#statics.blanked(this.rangeOf(slot).cloneContents()))
  }

  parked(file: string, key: string): DocumentFragment | null {
    return this.#statics.parked(file, key)
  }

  parkedKeys(file: string): string[] {
    return this.#statics.keys(file)
  }

  branchesFor(file: string, slot: number): number[] {
    return this.#statics.branches(file, slot)
  }

  renderModeFor(file: string, slot?: number): RenderMode {
    return this.#statics.mode(file, slot)
  }

  materialize(file: string, key: string, dynamics: SlotValues = {}): DocumentFragment | null {
    return this.#statics.materialize(file, key, dynamics, (index) => this.#manifests.partsForFile(file, index))
  }

  switchBranch(slot: Slot, branch: number | null, dynamics: SlotValues = {}): boolean {
    if (branch === slot.branch) {
      return false
    }

    return this.#building("client", () => this.#swapBranch(slot, branch, dynamics))
  }

  prune(): number {
    const before = this.#regions.length

    this.#regions = this.#regions.filter((region) => this.#regionConnected(region))

    for (const region of this.#regions) {
      for (const [index, slot] of region.slots) {
        if (this.#slotConnected(slot)) {
          this.#pruneItems(slot)
        } else {
          region.slots.delete(index)
        }
      }
    }

    return before - this.#regions.length
  }

  #pruneItems(slot: Slot): void {
    if (slot.items.size === 0) {
      return
    }

    const live = this.#itemsInDocumentOrder(slot)

    slot.items.clear()

    for (const item of live) {
      for (const [index, nested] of item.slots) {
        if (this.#slotConnected(nested)) {
          this.#pruneItems(nested)
        } else {
          item.slots.delete(index)
        }
      }

      slot.items.set(item.key, item)
    }
  }

  #itemsInDocumentOrder(slot: Slot): Item[] {
    return [...slot.items.values()]
      .filter((item) => item.start.isConnected)
      .sort((left, right) => {
        const following = left.start.compareDocumentPosition(right.start) & Node.DOCUMENT_POSITION_FOLLOWING

        if (following) {
          return -1
        }

        return 1
      })
  }

  clear(): void {
    this.#regions = []
    this.#visited = new WeakSet()
    this.#statics.clear()
    this.#manifests.clear()
  }

  get size(): number {
    return this.#regions.reduce((total, region) => total + region.slots.size, 0)
  }

  #scanMarkers(root: Node, result: ScanResult, state: ParseState): void {
    for (const marker of markers(root)) {
      if (marker.nodeType === Node.ELEMENT_NODE) {
        const element = marker as Element

        if (this.#visited.has(element)) {
          continue
        }

        this.#visited.add(element)

        this.#anchorSlots(element, result, state)

        continue
      }

      const comment = marker as Comment
      const parsed = parseMarker(comment.data.trim())

      if (!parsed) {
        continue
      }

      if (this.#visited.has(comment)) {
        this.#replay(parsed, comment, state)

        continue
      }

      this.#visited.add(comment)

      switch (parsed.kind) {
        case "region-open":
          this.#openRegion(parsed, comment, result, state)
          break
        case "region-close":
          this.#closeRegion(parsed, comment, state)
          break
        case "slot-open":
          this.#openSlot(parsed, comment, result, state)
          break
        case "slot-close":
          this.#closeSlot(parsed, comment, state)
          break
        case "item-open":
          this.#openItem(parsed, comment, state)
          break
        case "item-close":
          this.#closeItem(parsed, comment, state)
          break
        case "seeds":
          this.#sowSeeds(parsed, state)
          break
        case "branch":
          this.#markBranch(parsed, state)
          break
      }
    }
  }

  #replay(marker: MarkerData, comment: Comment, state: ParseState): void {
    switch (marker.kind) {
      case "region-open": {
        const region = this.#regions.find((candidate) => candidate.file === marker.file && candidate.occurrence === marker.occurrence && candidate.version === marker.version)
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
        const slot = this.#holderAt(state)?.slots.get(marker.index)

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
        const collection = this.#collectionAt(state, marker.index)
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

  #openRegion(marker: RegionOpenMarker, comment: Comment, result: ScanResult, state: ParseState): void {
    const range: RegionRange = { start: comment, end: null }
    const existing = this.#regions.find((candidate) => candidate.file === marker.file && candidate.occurrence === marker.occurrence && candidate.version === marker.version)

    if (existing) {
      existing.ranges.push(range)
      state.openRegions.push({ region: existing, range })

      return
    }

    const region: Region = {
      file: marker.file,
      version: marker.version,
      occurrence: marker.occurrence,
      ranges: [range],
      slots: new Map(),
    }

    state.openRegions.push({ region, range })

    this.#regions.push(region)
    result.regions.push(region)
  }

  #closeRegion(marker: RegionCloseMarker, comment: Comment, state: ParseState): void {
    const open = popMatching(state.openRegions, (candidate) => candidate.region.file === marker.file)

    if (!open) {
      return
    }

    open.range.end = comment
  }

  #openSlot(marker: SlotOpenMarker, comment: Comment, result: ScanResult, state: ParseState): void {
    const region = this.#regionAt(state)

    if (!region) {
      return
    }

    const item = this.#itemAt(state, region)
    const enclosing = this.#slotAt(state, region)

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
    }

    state.openSlots.push({ index: slot.index, slot })

    this.#attach(region, slot, result, enclosing, item)
  }

  #closeSlot(marker: SlotCloseMarker, comment: Comment, state: ParseState): void {
    const open = popMatching(state.openSlots, (candidate) => candidate.index === marker.index)

    if (open?.slot.anchor.kind === "range") {
      open.slot.anchor.end = comment
    }
  }

  #openItem(marker: ItemOpenMarker, comment: Comment, state: ParseState): void {
    const collection = this.#collectionAt(state, marker.index)

    if (!collection) {
      return
    }

    const item: Item = { key: marker.key, start: comment, end: comment, slots: new Map(), collection }

    collection.items.set(item.key, item)

    state.openItems.push({ slot: marker.index, item })
  }

  #closeItem(marker: ItemCloseMarker, comment: Comment, state: ParseState): void {
    const open = popMatching(state.openItems, (candidate) => candidate.slot === marker.index)

    if (open) {
      open.item.end = comment
    }
  }

  #sowSeeds(marker: SeedsMarker, state: ParseState): void {
    const holder = this.#holderAt(state)

    if (!holder) {
      return
    }

    holder.seeds = { ...(holder.seeds ?? {}), ...marker.seeds }
  }

  #markBranch(marker: BranchMarker, state: ParseState): void {
    const region = this.#regionAt(state)
    const branch = numericBranch(marker.branch)

    if (branch === null || !region) {
      return
    }

    const stacked = state.openSlots.find((candidate) => candidate.index === marker.index && candidate.slot.region === region)?.slot
    const slot = stacked ?? this.#holderAt(state)?.slots.get(marker.index)

    if (slot) {
      slot.branch = branch
    }
  }

  #regionAt(state: ParseState): Region | null {
    return last(state.openRegions)?.region ?? null
  }

  #holderAt(state: ParseState): Region | Item | null {
    const region = this.#regionAt(state)

    if (!region) {
      return null
    }

    return this.#itemAt(state, region) ?? region
  }

  #collectionAt(state: ParseState, index: number): Slot | null {
    const region = this.#regionAt(state)

    if (!region) {
      return null
    }

    const stacked = state.openSlots.find((candidate) => candidate.index === index && candidate.slot.region === region)?.slot

    if (stacked) {
      return stacked
    }

    return this.#holderAt(state)?.slots.get(index) ?? null
  }

  #slotAt(state: ParseState, region: Region): Slot | null {
    const stacked = last(state.openSlots)?.slot ?? null

    if (stacked && stacked.region === region) {
      return stacked
    }

    return null
  }

  #itemAt(state: ParseState, region: Region): Item | null {
    const opened = last(state.openItems)?.item ?? null

    if (opened && opened.collection.region === region) {
      return opened
    }

    return null
  }
  #anchorSlots(element: Element, result: ScanResult, state: ParseState): void {
    const region = this.#regionAt(state)

    if (!region) {
      return
    }

    const enclosing = this.#slotAt(state, region)
    const item = this.#itemAt(state, region)

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
      }

      this.#attach(region, slot, result, enclosing, item)
    }
  }

  #attach(region: Region | null, slot: Slot, result: ScanResult, parent: Slot | null = null, item: Item | null = null): void {
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

  #forget(slot: Slot): void {
    const owner = this.#owner(slot)

    if (owner.get(slot.index) === slot) {
      owner.delete(slot.index)
    }

    if (slot.parent) {
      slot.parent.children = slot.parent.children.filter((child) => child !== slot)
    }
  }

  #forgetChildren(slot: Slot): void {
    for (const descendant of this.descendantsOf(slot)) {
      this.#forget(descendant)
    }

    slot.children = []
  }

  #placementIn(region: Region, node: Node): Placement {
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

  #regionConnected(region: Region): boolean {
    region.ranges = region.ranges.filter((range) => range.start.isConnected)

    return region.ranges.length > 0
  }

  #slotConnected(slot: Slot): boolean {
    return connected(slot.anchor)
  }
}
