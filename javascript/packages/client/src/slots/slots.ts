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

import { SLOT_EVENT } from "../shared/events"

import { Journal } from "./journal"
import { Statics } from "./statics"
import { Manifests } from "./manifests"
import { Collections } from "./collections"
import { RegionIndex } from "./region-index"
import { ElementObserver } from "../shared/element-observer"

import { applyPayload } from "./apply"

import { ancestorsOf, descendantsOf } from "./tree"
import { branchKey } from "../markup/markers"
import { interpolateParts, valuesIn, withoutMarkers, fillSlots } from "../markup/fragments"
import { currentHTML, currentText, elementOf, htmlOf, innerRange, rangeOf as rangeOfAnchor } from "../markup/anchors"

import type { StateManifest } from "../state/types"
import type { TemplateManifest } from "./manifests"
import type { ElementObserverDelegate } from "../shared/element-observer"
import type { CollectionsDelegate } from "./collections"
import type { RegionIndexDelegate } from "./region-index"
import type { JournalDelegate } from "./journal"

import type { AddItemOptions, AttributeParts, ApplyMode, BuildCause, Built, SlotsDelegate, ApplyOptions, ApplyReport, Item, ItemMap, ItemPlan, ItemStep, Payload, Placement, Region, ScanContext, RenderMode, RevertToken, ScanResult, Slot, SlotAddress, SlotEventDetail, SlotOperation, SlotValue, SlotValues, StaticsIdentity, TransactionResult } from "../types"

export class Slots implements ElementObserverDelegate, JournalDelegate, CollectionsDelegate, RegionIndexDelegate {
  private journal = new Journal(this)
  private statics = new Statics()
  private manifests = new Manifests()
  private index = new RegionIndex(this, this.statics, this.manifests)
  private collections = new Collections(this, this.journal, this.statics, this.manifests)
  private cause: BuildCause = "client"
  private built: Built | null = null
  private delegates = new Set<SlotsDelegate>()
  private elements: ElementObserver | null = null
  private unobserve: (() => void) | null = null

  claim(slot: Slot): void {
    slot.claimed = true
  }

  observe(root: Node = document.documentElement, elements?: ElementObserver): ScanResult {
    this.unobserve?.()

    this.elements = elements ?? new ElementObserver()
    this.unobserve = this.elements.add(this)

    this.elements.observe(root)

    return this.scan(root)
  }

  nodesAdded(nodes: Node[]): void {
    this.scan(nodes)
  }

  nodesRemoved(): void {
    this.prune()
  }

  disconnect(): void {
    this.unobserve?.()
    this.unobserve = null
    this.elements = null
  }

  adoptManifests(manifests: Record<string, TemplateManifest>, options: { replace?: boolean } = {}): number {
    if (!options.replace) {
      return this.manifests.hold(manifests)
    }

    let held = 0

    for (const [identity, manifest] of Object.entries(manifests)) {
      this.manifests.push(identity, manifest)
      held += 1
    }

    return held
  }

  statesFor(file: string, version: string): StateManifest | null {
    return this.manifests.statesOf(file, version)
  }

  holdStatics(identity: StaticsIdentity, statics: Record<string, string>): number {
    let parked = 0

    for (const [key, markup] of Object.entries(statics)) {
      const template = document.createElement("template")

      template.innerHTML = markup

      this.statics.push(identity, key, template.content)
      parked += 1
    }

    return parked
  }

  evictManifests(file: string, keepVersion: string): number {
    return this.manifests.evict(file, keepVersion)
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

  apply(payload: Payload, options: ApplyOptions = {}): ApplyReport {
    return this.building("apply", () => applyPayload(this, payload, options.items ?? "replace"))
  }

  scan(roots: Node | Node[], context?: ScanContext): ScanResult {
    return this.index.scan(roots, context)
  }

  locate(node: Node): Placement | null {
    return this.index.locate(node)
  }

  placements(node: Node): Placement[] {
    return this.index.placements(node)
  }

  regionsFor(file: string): Region[] {
    return this.index.regionsFor(file)
  }

  regions(): Region[] {
    return this.index.regions()
  }

  files(): string[] {
    return this.index.files()
  }

  slotsFor(file: string, index: number): Slot[] {
    return this.index.slotsFor(file, index)
  }

  region(file: string, occurrence = 0): Region | null {
    return this.index.region(file, occurrence)
  }

  slot(file: string, index: number | string, occurrence = 0): Slot | null {
    return this.index.slot(file, index, occurrence)
  }

  itemsFor(file: string, index: number | string, occurrence = 0): ItemMap {
    return this.index.itemsFor(file, index, occurrence)
  }

  slotInItem(file: string, collection: number | string, key: string, index: number | string, occurrence = 0): Slot | null {
    return this.index.slotInItem(file, collection, key, index, occurrence)
  }

  regionOf(slot: Slot): Region {
    return this.index.regionOf(slot)
  }

  slotAt(address: SlotAddress): Slot | null {
    return this.index.slotAt(address)
  }

  get size(): number {
    return this.index.size
  }

  prune(): number {
    return this.index.prune()
  }

  pruneItems(slot: Slot): void {
    this.collections.pruneItems(slot)
  }

  clear(): void {
    this.index.clear()
  }

  subscribe(delegate: SlotsDelegate): () => void {
    this.delegates.add(delegate)

    return () => {
      this.delegates.delete(delegate)
    }
  }

  building<T>(cause: BuildCause, work: () => T): T {
    if (this.built) {
      return work()
    }

    const built: Built = { branches: [], items: [] }
    const previous = this.cause

    this.built = built
    this.cause = cause

    try {
      return work()
    } finally {
      this.built = null
      this.cause = previous

      if (built.branches.length > 0 || built.items.length > 0) {
        this.announceBuilt(built, cause)
      }
    }
  }

  transaction<T>(work: () => T): TransactionResult<T> {
    return this.journal.transaction(work)
  }

  revert(token: RevertToken): boolean {
    return this.journal.revert(token)
  }

  addressOf(slot: Slot): SlotAddress {
    const path: ItemStep[] = []

    let item = slot.item

    while (item) {
      path.unshift({ collection: item.collection.index, key: item.key })

      item = item.collection.item
    }

    return { region: slot.region, path, index: slot.index }
  }

  private swapBranch(slot: Slot, branch: number | null, dynamics: SlotValues): boolean {
    this.journal.record(slot, () => {
      const before = this.current(slot)
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

    const markup = this.branchMarkup(slot, branch, dynamics)

    if (!markup) {
      return false
    }

    this.writeFragment(slot, markup)

    slot.branch = branch

    this.built?.branches.push(slot)
    this.focusAutofocus(slot)

    return true
  }

  private branchMarkup(slot: Slot, branch: number, dynamics: SlotValues): DocumentFragment | null {
    const captured = slot.captured?.get(branch)

    if (captured) {
      const copy = captured.cloneNode(true) as DocumentFragment

      fillSlots(copy, { ...(slot.shown?.get(branch) ?? {}), ...dynamics }, false, (index) => this.manifests.partsForFile(slot.region.file, index))

      return copy
    }

    return this.materialize(slot.region.file, branchKey(slot.index, branch), { ...(slot.shown?.get(branch) ?? {}), ...dynamics })
  }

  private focusAutofocus(slot: Slot): void {
    if (typeof document === "undefined") {
      return
    }

    if (slot.anchor.kind !== "range" || !slot.anchor.start.isConnected) {
      return
    }

    const range = this.rangeOf(slot)
    const holder = range.commonAncestorContainer
    const root = holder instanceof Element ? holder : holder.parentElement

    const target = root?.querySelector<HTMLElement>("[autofocus]")

    if (target && range.intersectsNode(target) && document.activeElement !== target) {
      target.focus()
    }
  }

  private partsFor(region: Region, index: number): AttributeParts | null {
    return this.manifests.partsOf(region.file, region.version, index)
  }

  private rewrite(range: Range, source: DocumentFragment, context: ScanContext): ScanResult {
    const added = [...source.childNodes]

    range.deleteContents()
    range.insertNode(source)

    return this.scan(added, context)
  }

  private writeFragment(slot: Slot, fragment: DocumentFragment): void {
    this.index.forgetChildren(slot)
    this.rewrite(this.rangeOf(slot), fragment, { region: slot.region, slot, item: slot.item })
    this.announce(slot, "branch", (delegate) => delegate.branchSwitched?.(slot))
  }

  currentText(slot: Slot): string {
    return this.attributeValue(slot) ?? currentText(slot.anchor)
  }

  setText(slot: Slot, text: SlotValue): boolean {
    if (slot.anchor.kind === "element") {
      return false
    }

    let written = text

    if (slot.type === "raw_text_interpolation") {
      const whole = this.interpolate(slot, text)

      if (whole === null) {
        return false
      }

      written = whole
    }

    if (Array.isArray(written)) {
      return false
    }

    if (this.currentText(slot) === written) {
      return false
    }

    this.journal.record(slot, () => {
      const before = this.current(slot)

      return (live) => {
        this.update(live, before)
      }
    })

    this.index.forgetChildren(slot)

    if (slot.anchor.kind === "content") {
      slot.anchor.element.textContent = written
    } else {
      const fragment = document.createDocumentFragment()

      fragment.append(document.createTextNode(written))

      this.rewrite(this.rangeOf(slot), fragment, { region: slot.region, slot, item: slot.item })
    }

    this.announce(slot, "value", (delegate) => delegate.valueWritten?.(slot))

    return true
  }

  private attributeValue(slot: Slot): string | null {
    const element = elementOf(slot.anchor)

    if (!element || !slot.attribute) {
      return null
    }

    return element.getAttribute(slot.attribute) ?? ""
  }

  private current(slot: Slot): string {
    return currentHTML(slot.anchor)
  }

  covers(slot: Slot, value: SlotValue): boolean {
    if (Array.isArray(value)) {
      return false
    }

    return withoutMarkers(this.current(slot)) === withoutMarkers(value)
  }

  holds(slot: Slot, value: SlotValue): boolean {
    if (slot.type === "attribute_interpolation") {
      const whole = this.interpolate(slot, value)

      if (whole === null) {
        return false
      }

      return this.attributeValue(slot) === whole
    }

    if (slot.type === "raw_text_interpolation") {
      const whole = this.interpolate(slot, value)

      if (whole === null) {
        return false
      }

      return this.currentText(slot) === whole
    }

    if (Array.isArray(value)) {
      return false
    }

    const attribute = this.attributeValue(slot)

    if (attribute === null) {
      return this.current(slot) === value
    }

    return attribute === value
  }

  private announce(slot: Slot, operation: SlotOperation, tell: (delegate: SlotsDelegate) => void, { key = null, item = null, previousKey = null }: { key?: string | null; item?: Item | null; previousKey?: string | null } = {}): void {
    const region = slot.region ?? null

    for (const delegate of [...this.delegates]) {
      tell(delegate)
    }

    this.dispatch({
      file: region?.file ?? "",
      occurrence: region?.occurrence ?? 0,
      index: slot.index,
      operation,
      key,
      previousKey,
      slot,
      item,
      cause: this.cause,
    })
  }

  private announceBuilt(built: Built, cause: BuildCause): void {
    const [slot] = built.branches.length > 0 ? built.branches : built.items.map((entry) => entry.slot)
    const region = slot?.region ?? null

    for (const delegate of [...this.delegates]) {
      delegate.built?.(built)
    }

    this.dispatch({
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

  private dispatch(detail: SlotEventDetail): void {
    if (typeof document === "undefined") {
      return
    }

    document.dispatchEvent(new CustomEvent<SlotEventDetail>(SLOT_EVENT, { detail }))
  }

  update(slot: Slot, html: string): ScanResult {
    if (this.current(slot) === html) {
      return { regions: [], slots: [] }
    }

    this.journal.record(slot, () => {
      const before = this.current(slot)

      return (live) => {
        this.update(live, before)
      }
    })

    this.index.forgetChildren(slot)

    if (slot.anchor.kind === "element") {
      const replacement = this.rangeOf(slot).createContextualFragment(html)
      const element = slot.anchor.element
      const parent = element.parentNode

      element.replaceWith(replacement)
      this.index.forget(slot)

      if (!parent) {
        return this.scan([])
      }

      return this.scan([...parent.childNodes], { region: slot.region, slot: slot.parent, item: slot.item })
    }

    const range = this.rangeOf(slot)
    const result = this.rewrite(range, range.createContextualFragment(html), { region: slot.region, slot, item: slot.item })

    this.announce(slot, "value", (delegate) => delegate.valueWritten?.(slot))

    return result
  }

  updateItem(slot: Slot, key: string, html: string): ScanResult | null {
    const item = slot.items.get(key)

    if (!item) {
      return null
    }

    if (htmlOf(this.rangeOf(item)) === html) {
      return { regions: [], slots: [] }
    }

    this.journal.record(slot, () => {
      const before = htmlOf(this.rangeOf(item))

      return (live) => {
        this.updateItem(live, key, before)
      }
    })

    const range = this.rangeOf(item)
    const result = this.rewrite(range, range.createContextualFragment(html), { region: slot.region, slot, item })

    this.announce(slot, "item-updated", (delegate) => delegate.itemUpdated?.(slot, key, slot.items.get(key) ?? null), {
      key,
      item: slot.items.get(key) ?? null,
    })

    return result
  }

  setAttribute(slot: Slot, value: SlotValue | null, name = slot.attribute): boolean {
    if (!elementOf(slot.anchor) || name === null) {
      return false
    }

    let written: SlotValue | null = value

    if (slot.type === "attribute_interpolation") {
      written = this.interpolate(slot, value)

      if (written === null) {
        return false
      }
    }

    if (Array.isArray(written)) {
      return false
    }

    return this.writeAttribute(slot, written, name)
  }

  private writeAttribute(slot: Slot, value: string | null, name: string): boolean {
    const element = elementOf(slot.anchor)

    if (!element) {
      return false
    }

    if (element.getAttribute(name) === value) {
      return true
    }

    this.journal.record(slot, () => {
      const before = element.getAttribute(name)

      return (live) => {
        this.writeAttribute(live, before, name)
      }
    })

    if (value === null) {
      element.removeAttribute(name)
    } else {
      element.setAttribute(name, value)
    }

    this.announce(slot, "attribute", (delegate) => delegate.attributeWritten?.(slot))

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

    this.journal.record(slot, () => {
      const before = element.hasAttribute(name)

      return (live) => {
        this.setBooleanAttribute(live, before, name)
      }
    })

    element.toggleAttribute(name, present)

    if (name in element) {
      ;(element as unknown as Record<string, unknown>)[name] = present
    }

    this.announce(slot, "attribute", (delegate) => delegate.attributeWritten?.(slot))

    return true
  }

  private interpolate(slot: Slot, value: SlotValue | null): string | null {
    if (value === null) {
      return null
    }

    return interpolateParts(this.partsFor(slot.region, slot.index), value)
  }

  capture(slot: Slot): boolean {
    if (slot.branch === null) {
      return false
    }

    const contents = this.rangeOf(slot).cloneContents()

    // A flat values map cannot say which item a collection slot's value
    // belongs to, so the branch also keeps a slot-local clone with its
    // values baked, and a later restore starts from that.
    const captured = slot.captured ?? new Map<number, DocumentFragment>()

    captured.set(slot.branch, contents.cloneNode(true) as DocumentFragment)
    slot.captured = captured

    this.remember(slot, slot.branch, valuesIn(contents))

    return this.statics.park(slot.region, branchKey(slot.index, slot.branch), this.statics.blanked(contents))
  }

  private remember(slot: Slot, branch: number, values: SlotValues): void {
    const shown = slot.shown ?? new Map<number, SlotValues>()

    shown.set(branch, values)

    slot.shown = shown
  }

  parked(file: string, key: string): DocumentFragment | null {
    return this.statics.parked(file, key)
  }

  parkedKeys(file: string): string[] {
    return this.statics.keys(file)
  }

  branchesFor(file: string, slot: number): number[] {
    return this.statics.branches(file, slot)
  }

  renderModeFor(file: string, slot?: number): RenderMode {
    return this.statics.mode(file, slot)
  }

  materialize(file: string, key: string, dynamics: SlotValues = {}): DocumentFragment | null {
    return this.statics.materialize(file, key, dynamics, (index) => this.manifests.partsForFile(file, index))
  }

  switchBranch(slot: Slot, branch: number | null, dynamics: SlotValues = {}): boolean {
    if (branch === slot.branch) {
      return false
    }

    return this.building("client", () => this.swapBranch(slot, branch, dynamics))
  }

  recordBuilt(slot: Slot, item: Item): void {
    this.built?.items.push({ slot, item })
  }

  announceBranchMaterial(slot: Slot): void {
    this.announce(slot, "branch-material", (delegate) => delegate.branchMaterial?.(slot), {})
  }

  announceItemAdded(slot: Slot, key: string, item: Item | null): void {
    this.announce(slot, "item-added", (delegate) => delegate.itemAdded?.(slot, key, item), { key, item })
  }

  announceItemRemoved(slot: Slot, key: string, item: Item | null): void {
    this.announce(slot, "item-removed", (delegate) => delegate.itemRemoved?.(slot, key, item), { key, item })
  }

  announceItemRekeyed(slot: Slot, key: string, previousKey: string, item: Item | null): void {
    this.announce(slot, "item-rekeyed", (delegate) => delegate.itemRekeyed?.(slot, key, previousKey, item), { key, item, previousKey })
  }

  reconcile(slot: Slot, keys: string[]): ItemPlan {
    return this.collections.reconcile(slot, keys)
  }

  reconcileItems(slot: Slot, wanted: string[], mode: ApplyMode = "replace"): string[] {
    return this.collections.reconcileItems(slot, wanted, mode)
  }

  addItem(slot: Slot, key: string, options: AddItemOptions = {}): Item | null {
    return this.collections.addItem(slot, key, options)
  }

  removeItem(slot: Slot, key: string): boolean {
    return this.collections.removeItem(slot, key)
  }

  rekeyItem(slot: Slot, from: string, to: string): boolean {
    return this.collections.rekeyItem(slot, from, to)
  }
}
