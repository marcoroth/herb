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

import { ITEM_STATICS } from "./markers"
import { HERB_ATTRIBUTES } from "./attributes"

import { anchorEntries, anchorKind, connected, currentHTML, currentText, elementOf, htmlOf, innerRange, markers, nameEntry, outerRange, rangeOf, staticsElements, withinBounds, withinRegion, withinRegionRange } from "./anchors"
import { asList, last, popMatching } from "./arrays"
import { isPayload, leaves } from "./payloads"
import { ancestorsOf, descendantsOf, link } from "./slots"
import { branchKey, itemMarker, itemStaticsKey, numericBranch, parseMarker, parseStaticsIdentity, partsKey } from "./markers"
import { attributeParts, blankSlots, fillSlots, interpolateParts, parkedBranches, templateNames } from "./fragments"

import type { BranchMarker, ItemCloseMarker, ItemOpenMarker, MarkerData, RegionCloseMarker, RegionOpenMarker, SeedsMarker, SlotCloseMarker, SlotOpenMarker } from "./markers"
import type { AddItemOptions, AppliedValue, ApplyMode, ApplyOptions, ApplyReport, AttributeParts, Branched, Collected, DeferredReason, Inverse, Item, ItemMap, ItemPlan, ItemValues, ParseState, PartsResolver, Payload, PayloadSlots, Placement, Region, RegionRange, ScanContext, RenderMode, Restore, RevertToken, ScanResult, SeededSlots, Slot, SlotAddress, SlotEventDetail, SlotMap, SlotOperation, SlotValue, SlotValues, Statics, StaticsIdentity, TransactionResult } from "./types"

export const SLOT_EVENT = "herb:slot-update"

const MAX_JOURNAL = 50
const NUMERIC_NAME = /^\d+$/

export class SlotIndex {
  #regions: Region[] = []
  #visited = new WeakSet<Node>()
  #journal = new Map<RevertToken, Inverse[]>()
  #recording: Inverse[] | null = null
  #nextToken = 1
  #statics = new Map<string, Statics>()
  #applying = 0
  #observer: MutationObserver | null = null

  claim(slot: Slot): void {
    slot.claimed = true
  }

  observe(root: Node = document.documentElement): ScanResult {
    this.#observer?.disconnect()

    this.#observer = new MutationObserver((records) => {
      const added: Node[] = []

      let removed = false

      for (const record of records) {
        added.push(...record.addedNodes)

        if (record.removedNodes.length > 0) {
          removed = true
        }
      }

      if (added.length > 0) {
        this.scan(added)
      }

      if (removed) {
        this.prune()
      }
    })

    this.#observer.observe(root, { childList: true, subtree: true })

    return this.scan(root)
  }

  disconnect(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  scan(roots: Node | Node[], context?: ScanContext): ScanResult {
    const result: ScanResult = { regions: [], slots: [] }
    const list = asList(roots)

    for (const group of siblingGroups(list)) {
      const state = this.#seed(context ?? this.locate(group[0]) ?? {})

      for (const root of group) {
        this.#scanMarkers(root, result, state)
      }
    }

    for (const root of list) {
      this.#scanStatics(root)
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

      found.push({ region, slot: this.#enclosingSlot(region, node), item: this.#enclosingItem(region, node) })
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

    const name = region.names.get(index)

    if (name !== undefined) {
      return name
    }

    const owner = item?.slots ?? region.slots

    for (const slot of owner.values()) {
      if (slot.attribute === index) {
        return slot.index
      }
    }

    return null
  }

  rangeFor(slot: Slot): Range {
    return rangeOf(slot.anchor)
  }

  rangeForItem(item: Item): Range {
    return innerRange(item)
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
    const report: ApplyReport = { applied: 0, deferred: [] }

    this.#applying += 1

    try {
      this.#applyPayload(payload, report, options.items ?? "replace")
    } finally {
      this.#applying -= 1
    }

    return report
  }

  applying(): boolean {
    return this.#applying > 0
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
    return {
      region: slot.region,
      collection: slot.item?.collection.index ?? null,
      key: slot.item?.key ?? null,
      index: slot.index,
    }
  }

  #slotAtAddress(address: SlotAddress): Slot | null {
    const { region, collection, key, index } = address

    if (collection === null || key === null) {
      return region.slots.get(index) ?? null
    }

    return region.slots.get(collection)?.items.get(key)?.slots.get(index) ?? null
  }

  #applyPayload(payload: Payload, report: ApplyReport, mode: ApplyMode): void {
    const region = this.region(payload.template, payload.occurrence)

    if (!region) {
      this.#defer(report, payload, null, "no-region")

      return
    }

    if (region.version !== payload.version) {
      this.#defer(report, payload, null, "stale-version")

      return
    }

    this.#applySlots(payload, region.slots, payload.slots, report, mode)
  }

  #applySlots(payload: Payload, owner: SlotMap, values: PayloadSlots, report: ApplyReport, mode: ApplyMode): void {
    for (const [key, value] of Object.entries(values)) {
      if (isPayload(value)) {
        this.#applyPayload(value, report, mode)

        continue
      }

      const index = Number(key)
      const slot = owner.get(index)

      if (!slot) {
        this.#defer(report, payload, index, "no-slot")

        continue
      }

      if (slot.claimed) {
        continue
      }

      this.#applyValue(payload, slot, index, value, report, mode)
    }
  }

  #applyValue(payload: Payload, slot: Slot, index: number, value: AppliedValue, report: ApplyReport, mode: ApplyMode): void {
    if (typeof value === "boolean") {
      if (this.setBooleanAttribute(slot, value)) {
        report.applied += 1
      } else {
        this.#defer(report, payload, index, "partial-attribute")
      }

      return
    }

    if (typeof value === "string" || Array.isArray(value)) {
      this.#applyLeaf(payload, slot, index, value, report)

      return
    }

    if ("items" in value) {
      this.#applyItems(payload, slot, value, report, mode)
    } else {
      this.#applyBranch(payload, slot, value, report, mode)
    }
  }

  #applyLeaf(payload: Payload, slot: Slot, index: number, value: SlotValue, report: ApplyReport): void {
    if (slot.type === "block" && slot.children.length > 0) {
      return
    }

    if (this.#same(slot, value)) {
      return
    }

    if (slot.attribute) {
      if (!this.setAttribute(slot, value)) {
        this.#defer(report, payload, index, "partial-attribute")

        return
      }
    } else {
      if (Array.isArray(value)) {
        this.#defer(report, payload, index, "partial-attribute")

        return
      }

      this.update(slot, value)
    }

    report.applied += 1
  }

  #applyBranch(payload: Payload, slot: Slot, value: Branched, report: ApplyReport, mode: ApplyMode): void {
    if (value.branch !== slot.branch) {
      if (!this.#swapBranch(slot, value.branch, leaves(value.slots))) {
        this.#defer(report, payload, slot.index, "branch")

        return
      }

      report.applied += 1
    }

    if (value.slots) {
      this.#applySlots(payload, this.#owner(slot), value.slots, report, mode)
    }
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

    const built = this.materialize(slot.region.file, branchKey(slot.index, branch), dynamics)

    if (!built) {
      return false
    }

    this.#writeFragment(slot, built)

    slot.branch = branch

    return true
  }

  #applyItems(payload: Payload, slot: Slot, value: Collected, report: ApplyReport, mode: ApplyMode): void {
    const wanted = Object.keys(value.items)

    if (mode === "merge") {
      this.#mergeItems(payload, slot, wanted, report)
    } else {
      const plan = this.reconcile(slot, wanted)

      if (!plan.unchanged) {
        const unbuilt = this.#reconcileItems(slot, wanted, plan)

        if (unbuilt.length > 0) {
          this.#defer(report, payload, slot.index, "items", unbuilt)
        }
      }
    }

    for (const key of wanted) {
      const item = slot.items.get(key)

      if (!item) {
        continue
      }

      const { seeds, ...slots } = value.items[key] as SeededSlots

      if (seeds) {
        item.seeds = { ...(item.seeds ?? {}), ...seeds }
      }

      this.#applySlots(payload, item.slots, slots, report, mode)
    }
  }

  #mergeItems(payload: Payload, slot: Slot, wanted: string[], report: ApplyReport): void {
    const added = wanted.filter((key) => !slot.items.has(key))

    if (added.length === 0) {
      return
    }

    const template = this.#rowTemplate(slot)
    const anchor = this.#itemsEnd(slot)

    if (!template || !anchor) {
      this.#defer(report, payload, slot.index, "items", added)

      return
    }

    for (const key of added) {
      this.#buildItem(slot, key, template, anchor)
    }
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

    this.#park(slot.region, itemStaticsKey(slot.index), this.#rowFragment(item))
  }

  #buildItem(slot: Slot, key: string, template: DocumentFragment, anchor?: Node | null, values: SlotValues = {}, text = false): void {
    const copy = template.cloneNode(true) as DocumentFragment

    for (const marker of markers(copy)) {
      if (marker.nodeType !== Node.COMMENT_NODE) {
        continue
      }

      const comment = marker as Comment

      if (parseMarker(comment.data.trim())?.kind === "item-open") {
        comment.data = itemMarker(slot.index, key)
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
      const built = live.items.get(key)

      if (built) {
        this.#dropItem(live, built)
      }
    })

    this.#announce(slot, "item-added", slot.index, key, slot.items.get(key) ?? null)
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

  #partsResolver(slot: Slot): PartsResolver {
    return (index) => this.#partsFor(slot.region.file, index)
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

  #writeFragment(slot: Slot, fragment: DocumentFragment): void {
    this.#forgetChildren(slot)

    const range = this.rangeFor(slot)

    range.deleteContents()

    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    this.scan(added, { region: slot.region, slot, item: slot.item })

    this.#announce(slot, "branch", slot.index)
  }

  #owner(slot: Slot): SlotMap {
    return slot.item?.slots ?? slot.region.slots
  }

  #defer(report: ApplyReport, payload: Payload, index: number | null, reason: DeferredReason, keys?: string[]): void {
    const deferred = { file: payload.template, occurrence: payload.occurrence, index, reason }

    if (keys) {
      report.deferred.push({ ...deferred, keys })

      return
    }

    report.deferred.push(deferred)
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
      const range = this.rangeFor(slot)

      range.deleteContents()
      range.insertNode(document.createTextNode(text))
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

  #same(slot: Slot, value: SlotValue): boolean {
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
    if (typeof document === "undefined") {
      return
    }

    const region = slot?.region ?? null

    document.dispatchEvent(
      new CustomEvent<SlotEventDetail>(SLOT_EVENT, {
        detail: {
          file: region?.file ?? "",
          occurrence: region?.occurrence ?? 0,
          index,
          operation,
          key,
          previousKey,
          slot,
          item,
        },
      }),
    )
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
      const replacement = this.rangeFor(slot).createContextualFragment(html)
      const element = slot.anchor.element
      const parent = element.parentNode

      element.replaceWith(replacement)
      this.#forget(slot)

      if (!parent) {
        return this.scan([])
      }

      return this.scan([...parent.childNodes], { region: slot.region, slot: slot.parent, item: slot.item })
    }

    const range = this.rangeFor(slot)

    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    const result = this.scan(added, { region: slot.region, slot, item: slot.item })

    this.#announce(slot, "value", slot.index)

    return result
  }

  updateItem(slot: Slot, key: string, html: string): ScanResult | null {
    const item = slot.items.get(key)

    if (!item) {
      return null
    }

    this.#recordSlot(slot, () => {
      const before = htmlOf(this.rangeForItem(item))

      return (live) => {
        this.updateItem(live, key, before)
      }
    })

    const range = this.rangeForItem(item)

    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    const result = this.scan(added, { region: slot.region, slot, item })

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

    this.#buildItem(slot, key, template, anchor, values, options.text === true)

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
    const names = templateNames(template)
    const resolved: SlotValues = {}

    for (const [given, value] of Object.entries(values)) {
      if (NUMERIC_NAME.test(given)) {
        resolved[Number(given)] = value

        continue
      }

      const index = names.get(given) ?? slot.region.names.get(given)

      if (index !== undefined) {
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

    return interpolateParts(this.#partsFor(slot.region.file, slot.index), value)
  }

  #partsFor(file: string, index: number): AttributeParts | null {
    return attributeParts(this.parked(file, partsKey(index)))
  }

  capture(slot: Slot): boolean {
    if (slot.branch === null) {
      return false
    }

    const fragment = this.rangeFor(slot).cloneContents()

    blankSlots(fragment)

    return this.#park(slot.region, branchKey(slot.index, slot.branch), fragment)
  }

  parked(file: string, key: string): DocumentFragment | null {
    return this.#statics.get(file)?.fragments.get(key) ?? null
  }

  parkedKeys(file: string): string[] {
    return [...(this.#statics.get(file)?.fragments.keys() ?? [])]
  }

  branchesFor(file: string, slot: number): number[] {
    const prefix = `${slot}:`

    return this.parkedKeys(file)
      .filter((key) => key.startsWith(prefix))
      .map((key) => numericBranch(key.slice(prefix.length)))
      .filter((branch): branch is number => branch !== null)
      .sort((left, right) => left - right)
  }

  renderModeFor(file: string, slot?: number): RenderMode {
    if (slot === undefined) {
      if (this.parkedKeys(file).length > 0) {
        return "client"
      }

      return "server"
    }

    if (this.branchesFor(file, slot).length > 0) {
      return "client"
    }

    return "server"
  }

  materialize(file: string, key: string, dynamics: SlotValues = {}): DocumentFragment | null {
    const statics = this.parked(file, key)

    if (!statics) {
      return null
    }

    const copy = statics.cloneNode(true) as DocumentFragment

    fillSlots(copy, dynamics, false, (index) => this.#partsFor(file, index))

    return copy
  }

  switchBranch(slot: Slot, branch: number | null, dynamics: SlotValues = {}): boolean {
    if (branch === slot.branch) {
      return false
    }

    return this.#swapBranch(slot, branch, dynamics)
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
    this.#statics = new Map()
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
        this.#nameSlot(element, state)

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
        const region = this.#regions.find((candidate) => {
          return candidate.file === marker.file && candidate.occurrence === marker.occurrence && candidate.version === marker.version
        })
        const range = region?.ranges.find((candidate) => candidate.start === comment)

        if (region && range) {
          state.openRegions.push({ region, range })
        }

        break
      }
      case "region-close":
        popMatching(state.openRegions, (candidate) => candidate.region.file === marker.file)
        break
      case "slot-open": {
        const holder = last(state.openItems)?.item ?? this.#regionAt(state)
        const slot = holder?.slots.get(marker.index)

        if (slot && slot.anchor.kind === "range" && slot.anchor.start === comment) {
          state.openSlots.push({ index: slot.index, slot })
        }

        break
      }
      case "slot-close":
        popMatching(state.openSlots, (candidate) => candidate.index === marker.index)
        break
      case "item-open": {
        const collection = state.openSlots.find((candidate) => candidate.index === marker.index)?.slot ?? this.#regionAt(state)?.slots.get(marker.index)
        const item = collection?.items.get(marker.key)

        if (item && item.start === comment) {
          state.openItems.push({ slot: marker.index, item })
        }

        break
      }
      case "item-close":
        popMatching(state.openItems, (candidate) => candidate.slot === marker.index)
        break
      case "seeds":
      case "branch":
        break
    }
  }

  #openRegion(marker: RegionOpenMarker, comment: Comment, result: ScanResult, state: ParseState): void {
    const range: RegionRange = { start: comment, end: null }

    const existing = this.#regions.find((candidate) => {
      return candidate.file === marker.file && candidate.occurrence === marker.occurrence && candidate.version === marker.version
    })

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
      names: new Map(),
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
    const region = this.#regionAt(state)
    const collection = state.openSlots.find((candidate) => candidate.index === marker.index)?.slot ?? region?.slots.get(marker.index)

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
    const holder = last(state.openItems)?.item ?? this.#regionAt(state)

    if (!holder) {
      return
    }

    holder.seeds = { ...(holder.seeds ?? {}), ...marker.seeds }
  }

  #markBranch(marker: BranchMarker, state: ParseState): void {
    const region = this.#regionAt(state)
    const branch = numericBranch(marker.branch)

    if (branch === null) {
      return
    }

    const holder = last(state.openItems)?.item ?? region
    const slot = state.openSlots.find((candidate) => candidate.index === marker.index)?.slot ?? holder?.slots.get(marker.index)

    if (slot) {
      slot.branch = branch
    }
  }

  #regionAt(state: ParseState): Region | null {
    return last(state.openRegions)?.region ?? null
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

  #scanStatics(root: Node): void {
    for (const element of staticsElements(root)) {
      const identity = this.#staticsIdentity(element)

      if (!identity) {
        continue
      }

      for (const [key, fragment] of parkedBranches(element)) {
        this.#park(identity, key, fragment)
      }

      element.remove()
    }
  }

  #park(identity: StaticsIdentity, key: string, fragment: DocumentFragment): boolean {
    const { file, version } = identity
    const held = this.#statics.get(file)

    let statics: Statics = { version, fragments: new Map() }

    if (held && held.version === version) {
      statics = held
    }

    this.#statics.set(file, statics)

    if (statics.fragments.has(key)) {
      return false
    }

    statics.fragments.set(key, fragment)

    return true
  }

  #staticsIdentity(element: HTMLTemplateElement): StaticsIdentity | null {
    return parseStaticsIdentity(element.getAttribute(HERB_ATTRIBUTES.region) ?? "")
  }

  #nameSlot(element: Element, state: ParseState): void {
    const entry = nameEntry(element)

    if (!entry) {
      return
    }

    this.#regionAt(state)?.names.set(entry.name, entry.index)
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

  #enclosingItem(region: Region, node: Node): Item | null {
    let innermost: Item | null = null

    for (const slot of this.#everySlot(region)) {
      for (const item of slot.items.values()) {
        if (!withinBounds(item, node)) {
          continue
        }

        if (!innermost || withinBounds(innermost, item.start)) {
          innermost = item
        }
      }
    }

    return innermost
  }

  *#everySlot(region: Region): Generator<Slot> {
    const queue = [...region.slots.values()]

    while (queue.length > 0) {
      const slot = queue.shift()!

      yield slot

      for (const item of slot.items.values()) {
        queue.push(...item.slots.values())
      }
    }
  }

  #enclosingSlot(region: Region, node: Node): Slot | null {
    let innermost: Slot | null = null

    for (const slot of this.#everySlot(region)) {
      if (slot.anchor.kind !== "range") {
        continue
      }

      if (!withinBounds(slot.anchor, node)) {
        continue
      }

      if (!innermost) {
        innermost = slot

        continue
      }

      if (innermost.anchor.kind === "range" && withinBounds(innermost.anchor, slot.anchor.start)) {
        innermost = slot
      }
    }

    return innermost
  }

  #regionConnected(region: Region): boolean {
    region.ranges = region.ranges.filter((range) => range.start.isConnected)

    return region.ranges.length > 0
  }

  #slotConnected(slot: Slot): boolean {
    return connected(slot.anchor)
  }
}

function siblingGroups(list: Node[]): Node[][] {
  const groups: Node[][] = []

  let current: Node[] = []
  let parent: Node | null | undefined

  for (const node of list) {
    if (current.length > 0 && node.parentNode === parent) {
      current.push(node)

      continue
    }

    if (current.length > 0) {
      groups.push(current)
    }

    current = [node]
    parent = node.parentNode
  }

  if (current.length > 0) {
    groups.push(current)
  }

  return groups
}

function rangeAround(region: Region, node: Node): RegionRange | null {
  return region.ranges.find((range) => withinRegionRange(range, node)) ?? null
}
