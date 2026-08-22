/**
 * An index over the slot markers `Herb::Engine::SlotVisitor` emits, so a client can find a
 * template's dynamic parts again after the page has rendered.
 *
 * Three properties of the markup drive the shape of this:
 *
 *   - Comments are not reachable by `querySelectorAll`, so ranges are found with a `TreeWalker`.
 *     Element-anchored slots are attributes and use the cheap selector path.
 *   - A marker pair is not necessarily a pair of siblings. The HTML parser inserts a `<tbody>`
 *     into a `<table>` and moves the items into it, leaving the markers that preceded them
 *     behind, so an item's opening and closing marker can sit at different depths. Pairing is by
 *     index on a stack, never by walking siblings.
 *   - One template can be on the page many times, so a file maps to a list of regions rather
 *     than to one.
 *
 * Scanning is incremental. `scan` takes whatever subtree just arrived and adds what it finds,
 * attaching slots to an already-indexed region when the new markup landed inside one.
 */

import { HERB_ATTRIBUTES } from "./attributes"

const REGION_OPEN = /^herb-region:(.*):([0-9a-f]+):(\d+)$/
const REGION_CLOSE = /^\/herb-region:(.*)$/
const SLOT_OPEN = /^herb-slot:(\d+)(?::([a-z_]+))?$/
const SLOT_CLOSE = /^\/herb-slot:(\d+)$/
const ITEM_OPEN = /^herb-item:(\d+):([\s\S]*)$/
const ITEM_CLOSE = /^\/herb-item:(\d+)$/
const BRANCH = /^herb-branch:(\d+):(\w+)$/
const MARKER = /^\/?herb-(region|slot|item|branch|seeds):/
const SEEDS = /^herb-seeds:([\s\S]*)$/
const STATICS_REGION = /^(.*):([0-9a-f]+)$/
const ITEM_STATICS = "item"
const STATICS_SELECTOR = `template[${HERB_ATTRIBUTES.region}], template[${HERB_ATTRIBUTES.statics}]`
const MAX_JOURNAL = 50
const PART_MARKER = "herb-part"

const ANCHOR_ATTRIBUTE = HERB_ATTRIBUTES.slot
const ANCHOR_SELECTOR = `[${ANCHOR_ATTRIBUTE}]`
const NAME_ATTRIBUTE = HERB_ATTRIBUTES.name
const NAME_ENTRY = /^(\d+):(.+)$/

const DEFAULT_SLOT_TYPE: SlotType = "child"

export type SlotType =
  | "child"
  | "conditional"
  | "collection"
  | "block"
  | "comment"
  | "attribute"
  | "attribute_interpolation"
  | "boolean_attribute"
  | "element"
  | "raw_text"

export type RenderMode = "server" | "client"

export type SlotAnchor =
  | { kind: "range"; start: Comment; end: Comment }
  | { kind: "element"; element: Element }
  | { kind: "content"; element: Element }

export type SlotMap = Map<number, Slot>
export type ItemMap = Map<string, Item>
export type FragmentMap = Map<string, DocumentFragment>
export type SlotValues = Record<number, string | string[]>
export type ItemValues = Record<number | string, string | string[]>

export interface AddItemOptions {
  values?: ItemValues
  before?: string
  text?: boolean
}

export interface ApplyOptions {
  items?: "replace" | "merge"
}

export type RevertToken = number

interface SlotAddress {
  region: Region | null
  collection: number | null
  key: string | null
  index: number
}

type Inverse = () => void

export interface StaticsIdentity {
  file: string
  version: string
}

export interface Item {
  key: string
  start: Comment
  end: Comment
  slots: SlotMap
  seeds?: Record<string, unknown>
}

export interface Slot {
  index: number
  type: SlotType
  attribute: string | null
  anchor: SlotAnchor
  items: ItemMap
  branch: number | null
  parent: Slot | null
  children: Slot[]
}

export type SlotOperation =
  | "value"
  | "attribute"
  | "markup"
  | "branch"
  | "item-added"
  | "item-rekeyed"
  | "item-removed"
  | "item-updated"

export interface SlotEventDetail {
  file: string
  occurrence: number
  index: number
  operation: SlotOperation
  key: string | null
  previousKey: string | null
  slot: Slot | null
  item: Item | null
}

export const SLOT_EVENT = "herb:slot-update"

export interface RegionRange {
  start: Comment
  end: Comment | null
}

export interface Region {
  file: string
  version: string
  occurrence: number
  ranges: RegionRange[]
  start: Comment | null
  end: Comment | null
  slots: SlotMap
  names: Map<string, number>
  seeds?: Record<string, unknown>
}

export interface ScanResult {
  regions: Region[]
  slots: Slot[]
}

export interface Payload {
  template: string
  version: string
  occurrence: number
  slots: PayloadSlots
}

export interface PayloadSlots {
  [index: string]: PayloadValue
}

export interface Branched {
  branch: number | null
  slots?: PayloadSlots
}

export interface Collected {
  items: { [key: string]: PayloadSlots }
}

export type PayloadValue = string | string[] | boolean | Payload | Branched | Collected

export type DeferredReason = "no-region" | "stale-version" | "no-slot" | "branch" | "items" | "partial-attribute"

export interface Deferred {
  file: string
  occurrence: number
  index: number | null
  reason: DeferredReason
  keys?: string[]
}

export interface ApplyReport {
  applied: number
  deferred: Deferred[]
  token?: RevertToken
}

export interface ItemPlan {
  added: string[]
  removed: string[]
  moved: string[]
  kept: string[]
  unchanged: boolean
}

interface Statics {
  version: string
  fragments: FragmentMap
}

interface OpenSlot {
  index: number
  slot: Slot
  region: Region | null
}

interface OpenItem {
  slot: number
  item: Item
}

interface OpenRegion {
  region: Region
  range: RegionRange
}

interface ParseState {
  openRegions: OpenRegion[]
  openSlots: OpenSlot[]
  openItems: OpenItem[]
}

export class SlotIndex {
  #regions: Region[] = []
  #seen = new WeakSet<Comment>()
  #anchored = new WeakSet<Element>()
  #named = new WeakSet<Element>()
  #journal = new Map<RevertToken, Inverse[]>()
  #recording: Inverse[] | null = null
  #nextToken = 1
  #slotRegions = new WeakMap<Slot, Region>()
  #slotOwners = new WeakMap<Slot, SlotMap>()
  #skeletons = new Map<string, Statics>()
  #clientOwned = new WeakSet<Slot>()
  #observer: MutationObserver | null = null

  claim(slot: Slot): void {
    this.#clientOwned.add(slot)
  }

  claimed(slot: Slot): boolean {
    return this.#clientOwned.has(slot)
  }

  observe(root: Node = document.documentElement): ScanResult {
    this.#observer?.disconnect()

    this.#observer = new MutationObserver((records) => {
      const added: Node[] = []
      let removed = false

      for (const record of records) {
        added.push(...record.addedNodes)

        if (record.removedNodes.length > 0) removed = true
      }

      if (added.length > 0) this.scan(added)
      if (removed) this.prune()
    })

    this.#observer.observe(root, { childList: true, subtree: true })

    return this.scan(root)
  }

  disconnect(): void {
    this.#observer?.disconnect()
    this.#observer = null
  }

  scan(roots: Node | Node[]): ScanResult {
    const result: ScanResult = { regions: [], slots: [] }
    const state: ParseState = { openRegions: [], openSlots: [], openItems: [] }
    const list = Array.isArray(roots) ? roots : [roots]

    for (const root of list) this.#scanMarkers(root, result, state)
    for (const root of list) this.#scanSkeletons(root)

    return result
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
    return this.regionsFor(file).map((region) => region.slots.get(index)).filter((slot): slot is Slot => slot !== undefined)
  }

  region(file: string, occurrence = 0): Region | null {
    return this.regionsFor(file).find((region) => region.occurrence === occurrence) ?? null
  }

  slot(file: string, index: number | string, occurrence = 0): Slot | null {
    const region = this.region(file, occurrence)

    if (!region) return null

    const resolved = this.#slotIndex(region, index, null)

    return resolved === null ? null : (region.slots.get(resolved) ?? null)
  }

  itemsFor(file: string, index: number | string, occurrence = 0): ItemMap {
    return this.slot(file, index, occurrence)?.items ?? new Map()
  }

  slotInItem(file: string, collection: number | string, key: string, index: number | string, occurrence = 0): Slot | null {
    const region = this.region(file, occurrence)
    const item = this.itemsFor(file, collection, occurrence).get(key)

    if (!region || !item) return null

    const resolved = this.#slotIndex(region, index, item)

    return resolved === null ? null : (item.slots.get(resolved) ?? null)
  }

  #slotIndex(region: Region, index: number | string, item: Item | null): number | null {
    if (typeof index === "number") return index

    const name = region.names.get(index)

    if (name !== undefined) return name

    for (const slot of (item?.slots ?? region.slots).values()) {
      if (slot.attribute === index) return slot.index
    }

    return null
  }

  rangeFor(slot: Slot): Range {
    const range = document.createRange()

    if (slot.anchor.kind === "range") {
      range.setStartAfter(slot.anchor.start)
      range.setEndBefore(slot.anchor.end)
    } else if (slot.anchor.kind === "content") {
      range.selectNodeContents(slot.anchor.element)
    } else {
      range.selectNode(slot.anchor.element)
    }

    return range
  }

  rangeForItem(item: Item): Range {
    const range = document.createRange()

    range.setStartAfter(item.start)
    range.setEndBefore(item.end)

    return range
  }

  descendantsOf(slot: Slot): Slot[] {
    const found: Slot[] = []
    const queue = [...slot.children]

    while (queue.length > 0) {
      const next = queue.shift()!

      found.push(next)
      queue.push(...next.children)
    }

    return found
  }

  ancestorsOf(slot: Slot): Slot[] {
    const found: Slot[] = []

    let current = slot.parent

    while (current) {
      found.push(current)
      current = current.parent
    }

    return found
  }

  regionOf(slot: Slot): Region | null {
    return this.#slotRegions.get(slot) ?? null
  }

  reconcile(slot: Slot, keys: string[]): ItemPlan {
    const present = this.#itemsInDocumentOrder(slot).map((item) => item.key)
    const wanted = new Set(keys)

    const removed = present.filter((key) => !wanted.has(key))
    const added = keys.filter((key) => !present.includes(key))
    const kept = keys.filter((key) => present.includes(key))
    const order = present.filter((key) => wanted.has(key))
    const moved = kept.filter((key, position) => order[position] !== key)

    return { added, removed, moved, kept, unchanged: added.length === 0 && removed.length === 0 && moved.length === 0 }
  }

  apply(payload: Payload, options: ApplyOptions = {}): ApplyReport {
    const report: ApplyReport = { applied: 0, deferred: [] }

    const { token } = this.transaction(() => {
      this.#applyPayload(payload, report, options.items ?? "replace")
    })

    if (token !== null) report.token = token

    return report
  }

  transaction<T>(work: () => T, options: { retain?: boolean } = {}): { token: RevertToken | null; result: T } {
    if (this.#recording || options.retain === false) return { token: null, result: work() }

    const inverses: Inverse[] = []

    this.#recording = inverses

    let result: T

    try {
      result = work()
    } finally {
      this.#recording = null
    }

    if (inverses.length === 0) return { token: null, result }

    const token = this.#nextToken++

    this.#journal.set(token, inverses)

    if (this.#journal.size > MAX_JOURNAL) {
      const oldest = this.#journal.keys().next().value

      if (oldest !== undefined) this.#journal.delete(oldest)
    }

    return { token, result }
  }

  revert(token: RevertToken): boolean {
    const inverses = this.#journal.get(token)

    if (!inverses) return false

    this.#journal.delete(token)

    for (let position = inverses.length - 1; position >= 0; position -= 1) inverses[position]()

    return true
  }

  #record(make: () => Inverse): void {
    if (!this.#recording) return

    this.#recording.push(make())
  }

  #addressOf(slot: Slot): SlotAddress {
    const region = this.#slotRegions.get(slot) ?? null
    const owner = this.#owner(slot)
    let collection: number | null = null
    let key: string | null = null

    if (region && owner !== region.slots) {
      for (const candidate of region.slots.values()) {
        if (candidate.type !== "collection") continue

        for (const item of candidate.items.values()) {
          if (item.slots === owner) {
            collection = candidate.index
            key = item.key
            break
          }
        }

        if (key !== null) break
      }
    }

    return { region, collection, key, index: slot.index }
  }

  #slotAt(address: SlotAddress): Slot | null {
    const { region, collection, key, index } = address

    if (!region) return null
    if (collection === null || key === null) return region.slots.get(index) ?? null

    return region.slots.get(collection)?.items.get(key)?.slots.get(index) ?? null
  }

  #applyPayload(payload: Payload, report: ApplyReport, mode: "replace" | "merge"): void {
    const region = this.region(payload.template, payload.occurrence)

    if (!region) return this.#defer(report, payload, null, "no-region")
    if (region.version !== payload.version) return this.#defer(report, payload, null, "stale-version")

    this.#applySlots(payload, region.slots, payload.slots, report, mode)
  }

  #applySlots(payload: Payload, owner: SlotMap, values: PayloadSlots, report: ApplyReport, mode: "replace" | "merge"): void {
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

      if (this.#clientOwned.has(slot)) continue


      if (typeof value === "boolean") {
        if (this.setBooleanAttribute(slot, value)) report.applied += 1
        else this.#defer(report, payload, index, "partial-attribute")

        continue
      }

      if (typeof value === "string" || Array.isArray(value)) {
        if (this.#same(slot, value)) continue

        if (slot.attribute && !this.setAttribute(slot, value)) {
          this.#defer(report, payload, index, "partial-attribute")
          continue
        }

        if (!slot.attribute) {
          if (Array.isArray(value)) {
            this.#defer(report, payload, index, "partial-attribute")
            continue
          }

          this.update(slot, value)
        }

        report.applied += 1
        continue
      }

      if ("items" in value) this.#applyItems(payload, slot, value, report, mode)
      else this.#applyBranch(payload, slot, value, report, mode)
    }
  }

  #applyBranch(payload: Payload, slot: Slot, value: Branched, report: ApplyReport, mode: "replace" | "merge"): void {
    if (value.branch === slot.branch) {
      if (value.slots) this.#applySlots(payload, this.#owner(slot), value.slots, report, mode)

      return
    }

    this.capture(slot)

    if (value.branch === null) {
      this.update(slot, "")
      slot.branch = null
      report.applied += 1

      return
    }

    const built = this.materialize(payload.template, `${slot.index}:${value.branch}`, leaves(value.slots))

    if (!built) return this.#defer(report, payload, slot.index, "branch")

    this.#record(() => {
      const before = this.#current(slot)
      const beforeBranch = slot.branch
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (!live) return

        this.update(live, before)
        live.branch = beforeBranch
      }
    })

    this.#writeFragment(slot, built)

    slot.branch = value.branch

    report.applied += 1

    if (value.slots) {
      this.#applySlots(payload, this.#owner(slot), value.slots, report, mode)
    }
  }

  #applyItems(payload: Payload, slot: Slot, value: Collected, report: ApplyReport, mode: "replace" | "merge"): void {
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

      if (item) {
        this.#applySlots(payload, item.slots, value.items[key], report, mode)
      }
    }
  }

  #mergeItems(payload: Payload, slot: Slot, wanted: string[], report: ApplyReport): void {
    const added = wanted.filter((key) => !slot.items.has(key))

    if (added.length === 0) return

    const template = this.#rowTemplate(slot)
    const anchor = slot.anchor.kind === "range" ? slot.anchor.end : null

    if (!template || !anchor) {
      this.#defer(report, payload, slot.index, "items", added)

      return
    }

    for (const key of added) this.#buildItem(slot, key, template, anchor)
  }

  #reconcileItems(slot: Slot, wanted: string[], plan: ItemPlan): string[] {
    const template = plan.added.length > 0 ? this.#rowTemplate(slot) : null

    for (const key of plan.removed) {
      const item = slot.items.get(key)

      if (!item) continue

      this.#dropItem(slot, item)
    }

    if (!template) {
      this.#order(slot, wanted.filter((key) => slot.items.has(key)))

      return plan.added
    }

    for (const key of plan.added) this.#buildItem(slot, key, template)

    this.#order(slot, wanted)

    return []
  }

  #rowTemplate(slot: Slot, prefer: "live" | "skeleton" = "live"): DocumentFragment | null {
    const region = this.#slotRegions.get(slot)
    const skeleton = region ? this.skeletonFor(region.file, `${slot.index}:${ITEM_STATICS}`) : null

    if (prefer === "skeleton" && skeleton) return skeleton

    const [item] = this.#itemsInDocumentOrder(slot)

    return item ? this.#rowFragment(item) : skeleton
  }

  #rowFragment(item: Item): DocumentFragment {
    const fragment = document.createRange().createContextualFragment("")
    const range = document.createRange()

    range.setStartBefore(item.start)
    range.setEndAfter(item.end)

    fragment.append(range.cloneContents())

    blankSlots(fragment)

    return fragment
  }

  #keepItem(slot: Slot, item: Item): void {
    if (slot.items.size > 1) return

    const region = this.#slotRegions.get(slot)

    if (!region) return

    this.#park(region, `${slot.index}:${ITEM_STATICS}`, this.#rowFragment(item))
  }

  #buildItem(slot: Slot, key: string, template: DocumentFragment, anchor?: Node | null, values: SlotValues = {}, text = false): void {
    const copy = template.cloneNode(true) as DocumentFragment

    for (const marker of this.#markers(copy)) {
      if (marker.nodeType !== Node.COMMENT_NODE) continue

      const comment = marker as Comment
      const open = ITEM_OPEN.exec(comment.data.trim())

      if (open) comment.data = `herb-item:${slot.index}:${key}`
    }

    for (const node of [...copy.childNodes]) {
      if (node.nodeType !== Node.COMMENT_NODE) continue

      const branch = BRANCH.exec((node as Comment).data.trim())

      if (branch && branch[2] === ITEM_STATICS) node.remove()
    }

    const region = this.#slotRegions.get(slot)

    fillSlots(copy, values, text, region ? (index) => this.#partsFor(region.file, index) : undefined)

    const added = [...copy.childNodes]
    const target =
      anchor ?? this.#itemsInDocumentOrder(slot)[0]?.start ?? (slot.anchor.kind === "range" ? slot.anchor.end : null)

    if (target) target.parentNode?.insertBefore(copy, target)
    else return

    this.scan(added)

    this.#record(() => {
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)
        const built = live?.items.get(key)

        if (live && built) this.#dropItem(live, built)
      }
    })

    this.#announce(slot, "item-added", slot.index, key, slot.items.get(key) ?? null)
  }

  #dropItem(slot: Slot, item: Item): void {
    this.#record(() => {
      const keep = document.createRange()

      keep.setStartBefore(item.start)
      keep.setEndAfter(item.end)

      const fragment = keep.cloneContents()
      const address = this.#addressOf(slot)
      const following = this.#itemsInDocumentOrder(slot)
      const nextKey = following[following.indexOf(item) + 1]?.key ?? null

      return () => {
        const live = this.#slotAt(address)

        if (!live || live.anchor.kind !== "range" || live.items.has(item.key)) return

        const target = (nextKey !== null ? live.items.get(nextKey)?.start : null) ?? live.anchor.end
        const copy = fragment.cloneNode(true) as DocumentFragment
        const added = [...copy.childNodes]

        target.parentNode?.insertBefore(copy, target)
        this.scan(added)
        this.#announce(live, "item-added", live.index, item.key, live.items.get(item.key) ?? null)
      }
    })

    this.#keepItem(slot, item)
    this.#announce(slot, "item-removed", slot.index, item.key, item)

    const range = document.createRange()

    range.setStartBefore(item.start)
    range.setEndAfter(item.end)
    range.deleteContents()

    slot.items.delete(item.key)
  }

  #order(slot: Slot, keys: string[]): void {
    if (slot.anchor.kind !== "range") return

    this.#record(() => {
      const before = this.#itemsInDocumentOrder(slot).map((item) => item.key)
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.#order(live, before)
      }
    })

    const end = slot.anchor.end

    for (const key of keys) {
      const item = slot.items.get(key)

      if (!item) continue

      const range = document.createRange()

      range.setStartBefore(item.start)
      range.setEndAfter(item.end)

      end.parentNode?.insertBefore(range.extractContents(), end)
    }

    this.#pruneItems(slot)
  }

  #writeFragment(slot: Slot, fragment: DocumentFragment): void {
    for (const descendant of this.descendantsOf(slot)) this.#forget(descendant)

    slot.children = []

    const range = this.rangeFor(slot)

    range.deleteContents()

    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    this.scan(added)

    this.#announce(slot, "branch", slot.index)
  }

  #owner(slot: Slot): SlotMap {
    return this.#slotOwners.get(slot) ?? this.#slotRegions.get(slot)?.slots ?? new Map()
  }

  #defer(report: ApplyReport, payload: Payload, index: number | null, reason: DeferredReason, keys?: string[]): void {
    report.deferred.push({ file: payload.template, occurrence: payload.occurrence, index, reason, ...(keys ? { keys } : {}) })
  }

  currentValue(slot: Slot): string {
    if (slot.anchor.kind !== "range" && slot.attribute) {
      return slot.anchor.element.getAttribute(slot.attribute) ?? ""
    }

    return this.#current(slot)
  }

  currentText(slot: Slot): string {
    if (slot.anchor.kind !== "range" && slot.attribute) {
      return slot.anchor.element.getAttribute(slot.attribute) ?? ""
    }

    if (slot.anchor.kind !== "range") return slot.anchor.element.textContent ?? ""

    return this.rangeFor(slot).toString()
  }

  setText(slot: Slot, text: string): boolean {
    if (slot.anchor.kind === "element") return false
    if (this.currentText(slot) === text) return false

    this.#record(() => {
      const before = this.#current(slot)
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.update(live, before)
      }
    })

    for (const descendant of this.descendantsOf(slot)) this.#forget(descendant)

    slot.children = []

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

  #current(slot: Slot): string {
    if (slot.anchor.kind === "content") return slot.anchor.element.innerHTML
    if (slot.anchor.kind === "element") return slot.anchor.element.outerHTML

    const holder = document.createElement("div")

    holder.append(this.rangeFor(slot).cloneContents())

    return holder.innerHTML
  }

  #same(slot: Slot, value: string | string[]): boolean {
    if (slot.type === "attribute_interpolation") {
      const whole = this.#interpolate(slot, value)

      if (whole === null || slot.anchor.kind === "range" || !slot.attribute) return false

      return slot.anchor.element.getAttribute(slot.attribute) === whole
    }

    if (Array.isArray(value)) return false

    if (slot.attribute && slot.anchor.kind !== "range") {
      return slot.anchor.element.getAttribute(slot.attribute) === value
    }

    return this.#current(slot) === value
  }

  #announce(slot: Slot | null, operation: SlotOperation, index: number, key: string | null = null, item: Item | null = null, previousKey: string | null = null): void {
    if (typeof document === "undefined") return

    const region = slot ? this.#slotRegions.get(slot) : null

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

    this.#record(() => {
      const before = this.#current(slot)
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.update(live, before)
      }
    })

    for (const descendant of this.descendantsOf(slot)) this.#forget(descendant)

    slot.children = []

    if (slot.anchor.kind === "element") {
      const replacement = this.rangeFor(slot).createContextualFragment(html)
      const element = slot.anchor.element
      const parent = element.parentNode

      element.replaceWith(replacement)
      this.#forget(slot)

      return this.scan(parent ? [...parent.childNodes] : [])
    }

    const range = this.rangeFor(slot)

    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    const result = this.scan(added)

    this.#announce(slot, "value", slot.index)

    return result
  }

  updateItem(slot: Slot, key: string, html: string): ScanResult | null {
    const item = slot.items.get(key)
    if (!item) return null

    this.#record(() => {
      const holder = document.createElement("div")

      holder.append(this.rangeForItem(item).cloneContents())

      const before = holder.innerHTML
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.updateItem(live, key, before)
      }
    })

    const range = this.rangeForItem(item)

    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    const result = this.scan(added)

    this.#announce(slot, "item-updated", slot.index, key, slot.items.get(key) ?? null)

    return result
  }

  addItem(slot: Slot, key: string, options: AddItemOptions = {}): Item | null {
    if (slot.type !== "collection" || slot.anchor.kind !== "range") return null
    if (slot.items.has(key)) return null

    const template = this.#rowTemplate(slot, "skeleton")

    if (!template) return null

    const anchor =
      options.before !== undefined ? (slot.items.get(options.before)?.start ?? slot.anchor.end) : slot.anchor.end

    this.#buildItem(slot, key, template, anchor, this.#itemValues(slot, template, options.values ?? {}), options.text === true)

    return slot.items.get(key) ?? null
  }

  removeItem(slot: Slot, key: string): boolean {
    const item = slot.items.get(key)

    if (!item) return false

    this.#dropItem(slot, item)

    return true
  }

  rekeyItem(slot: Slot, from: string, to: string): boolean {
    if (from === to || slot.items.has(to)) return false

    const item = slot.items.get(from)

    if (!item) return false

    item.start.data = `herb-item:${slot.index}:${to}`
    item.key = to
    slot.items.delete(from)
    slot.items.set(to, item)

    this.#record(() => {
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.rekeyItem(live, to, from)
      }
    })

    this.#announce(slot, "item-rekeyed", slot.index, to, item, from)

    return true
  }

  #itemValues(slot: Slot, template: DocumentFragment, values: ItemValues): SlotValues {
    const region = this.#slotRegions.get(slot)
    const names = templateNames(template)
    const resolved: SlotValues = {}

    for (const [given, value] of Object.entries(values)) {
      if (/^\d+$/.test(given)) {
        resolved[Number(given)] = value

        continue
      }

      const index = names.get(given) ?? region?.names.get(given)

      if (index !== undefined) resolved[index] = value
    }

    return resolved
  }

  setAttribute(slot: Slot, value: string | string[] | null, name = slot.attribute): boolean {
    if (slot.anchor.kind === "range" || name === null) return false

    if (slot.type === "attribute_interpolation") {
      const whole = this.#interpolate(slot, value)

      if (whole === null) return false

      value = whole
    }

    if (Array.isArray(value)) return false

    return this.#writeAttribute(slot, value, name)
  }

  #writeAttribute(slot: Slot, value: string | null, name: string): boolean {
    if (slot.anchor.kind === "range") return false
    if (slot.anchor.element.getAttribute(name) === value) return true

    this.#record(() => {
      const before = slot.anchor.kind === "range" ? null : slot.anchor.element.getAttribute(name)
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.#writeAttribute(live, before, name)
      }
    })

    if (value === null) {
      slot.anchor.element.removeAttribute(name)
    } else {
      slot.anchor.element.setAttribute(name, value)
    }

    this.#announce(slot, "attribute", slot.index)

    return true
  }

  setBooleanAttribute(slot: Slot, present: boolean, name = slot.attribute): boolean {
    if (slot.anchor.kind === "range" || name === null) return false
    if (slot.type !== "boolean_attribute") return false

    const element = slot.anchor.element

    if (element.hasAttribute(name) === present) return true

    this.#record(() => {
      const before = element.hasAttribute(name)
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (live) this.setBooleanAttribute(live, before, name)
      }
    })

    element.toggleAttribute(name, present)

    if (name in element) {
      ;(element as unknown as Record<string, unknown>)[name] = present
    }

    this.#announce(slot, "attribute", slot.index)

    return true
  }

  #interpolate(slot: Slot, value: string | string[] | null): string | null {
    if (value === null) return null

    const region = this.#slotRegions.get(slot)
    if (!region) return null

    return interpolateParts(this.#partsFor(region.file, slot.index), value)
  }

  #partsFor(file: string, index: number): string[] | null {
    return attributeParts(this.skeletonFor(file, `${index}:parts`))
  }

  capture(slot: Slot): boolean {
    const region = this.#slotRegions.get(slot)

    if (!region || slot.branch === null) return false

    const fragment = this.rangeFor(slot).cloneContents()

    blankSlots(fragment)

    return this.#park(region, `${slot.index}:${slot.branch}`, fragment)
  }

  skeletonFor(file: string, key: string): DocumentFragment | null {
    return this.#skeletons.get(file)?.fragments.get(key) ?? null
  }

  skeletonKeys(file: string): string[] {
    return [...(this.#skeletons.get(file)?.fragments.keys() ?? [])]
  }

  branchesFor(file: string, slot: number): number[] {
    const prefix = `${slot}:`

    return this.skeletonKeys(file)
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .filter((branch) => /^\d+$/.test(branch))
      .map(Number)
      .sort((a, b) => a - b)
  }

  renderModeFor(file: string, slot?: number): RenderMode {
    if (slot === undefined) {
      return this.skeletonKeys(file).length > 0 ? "client" : "server"
    }

    return this.branchesFor(file, slot).length > 0 ? "client" : "server"
  }

  materialize(file: string, key: string, dynamics: SlotValues = {}): DocumentFragment | null {
    const skeleton = this.skeletonFor(file, key)
    if (!skeleton) return null

    const copy = skeleton.cloneNode(true) as DocumentFragment

    fillSlots(copy, dynamics, false, (index) => this.#partsFor(file, index))

    return copy
  }

  switchBranch(slot: Slot, branch: number | null, dynamics: SlotValues = {}): boolean {
    if (branch === slot.branch) return false

    const region = this.regionOf(slot)

    if (!region) return false

    this.#record(() => {
      const before = this.#current(slot)
      const beforeBranch = slot.branch
      const address = this.#addressOf(slot)

      return () => {
        const live = this.#slotAt(address)

        if (!live) return

        this.update(live, before)
        live.branch = beforeBranch
      }
    })

    this.capture(slot)

    if (branch === null) {
      this.update(slot, "")
      slot.branch = null

      return true
    }

    const built = this.materialize(region.file, `${slot.index}:${branch}`, dynamics)

    if (!built) return false

    this.#writeFragment(slot, built)

    slot.branch = branch

    return true
  }

  prune(): number {
    const before = this.#regions.length

    this.#regions = this.#regions.filter((region) => this.#regionConnected(region))

    for (const region of this.#regions) {
      for (const [index, slot] of region.slots) {
        if (this.#slotConnected(slot)) this.#pruneItems(slot)
        else region.slots.delete(index)
      }
    }

    return before - this.#regions.length
  }

  #pruneItems(slot: Slot): void {
    if (slot.items.size === 0) return

    const live = this.#itemsInDocumentOrder(slot)

    slot.items.clear()

    for (const item of live) {
      for (const [index, nested] of item.slots) {
        if (!this.#slotConnected(nested)) item.slots.delete(index)
        else this.#pruneItems(nested)
      }

      slot.items.set(item.key, item)
    }
  }

  #itemsInDocumentOrder(slot: Slot): Item[] {
    return [...slot.items.values()]
      .filter((item) => item.start.isConnected)
      .sort((left, right) =>
        left.start.compareDocumentPosition(right.start) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
  }

  clear(): void {
    this.#regions = []
    this.#seen = new WeakSet()
    this.#anchored = new WeakSet()
    this.#named = new WeakSet()
    this.#skeletons = new Map()
  }

  get size(): number {
    return this.#regions.reduce((total, region) => total + region.slots.size, 0)
  }

  #scanMarkers(root: Node, result: ScanResult, state: ParseState): void {
    const { openRegions, openSlots, openItems } = state

    for (const marker of this.#markers(root)) {
      if (marker.nodeType === Node.ELEMENT_NODE) {
        this.#anchorSlots(marker as Element, result, state)
        this.#nameSlot(marker as Element, state)

        continue
      }

      const comment = marker as Comment

      if (this.#seen.has(comment)) continue

      const data = comment.data.trim()

      const regionOpen = REGION_OPEN.exec(data)

      if (regionOpen) {
        const file = regionOpen[1]
        const version = regionOpen[2]
        const occurrence = Number(regionOpen[3])
        const range: RegionRange = { start: comment, end: null }

        const existing = this.#regions.find(
          (candidate) => candidate.file === file && candidate.occurrence === occurrence && candidate.version === version,
        )

        if (existing) {
          existing.ranges.push(range)
          openRegions.push({ region: existing, range })
        } else {
          const region: Region = {
            file,
            version,
            occurrence,
            ranges: [range],
            start: comment,
            end: null,
            slots: new Map(),
            names: new Map(),
          }

          openRegions.push({ region, range })
          this.#regions.push(region)
          result.regions.push(region)
        }

        this.#seen.add(comment)

        continue
      }

      const regionClose = REGION_CLOSE.exec(data)

      if (regionClose) {
        const open = popMatching(openRegions, (candidate) => candidate.region.file === regionClose[1])

        if (open) {
          open.range.end = comment

          if (open.range === open.region.ranges[0]) open.region.end = comment
        }

        this.#seen.add(comment)

        continue
      }

      const slotOpen = SLOT_OPEN.exec(data)

      if (slotOpen) {
        const region = openRegions[openRegions.length - 1]?.region ?? this.#enclosingRegion(comment)
        const stacked = openSlots[openSlots.length - 1]?.slot ?? null
        const enclosing = stacked ?? (region ? this.#enclosingSlot(region, comment) : null)

        const slot: Slot = {
          index: Number(slotOpen[1]),
          type: (slotOpen[2] as SlotType) ?? DEFAULT_SLOT_TYPE,
          attribute: null,
          anchor: { kind: "range", start: comment, end: comment },
          items: new Map(),
          branch: null,
          parent: null,
          children: [],
        }

        openSlots.push({ index: slot.index, slot, region })

        this.#attach(region, slot, result, enclosing, openItems[openItems.length - 1]?.item ?? null)
        this.#seen.add(comment)

        continue
      }

      const slotClose = SLOT_CLOSE.exec(data)

      if (slotClose) {
        const open = popMatching(openSlots, (candidate) => candidate.index === Number(slotClose[1]))

        if (open && open.slot.anchor.kind === "range") open.slot.anchor.end = comment

        this.#seen.add(comment)

        continue
      }

      const itemOpen = ITEM_OPEN.exec(data)

      if (itemOpen) {
        const collectionIndex = Number(itemOpen[1])
        const region = openRegions[openRegions.length - 1]?.region ?? this.#enclosingRegion(comment)
        const collection = region?.slots.get(collectionIndex)
        const item: Item = { key: itemOpen[2], start: comment, end: comment, slots: new Map() }

        collection?.items.set(item.key, item)
        openItems.push({ slot: collectionIndex, item })
        this.#seen.add(comment)

        continue
      }

      const itemClose = ITEM_CLOSE.exec(data)

      if (itemClose) {
        const open = popMatching(openItems, (candidate) => candidate.slot === Number(itemClose[1]))

        if (open) open.item.end = comment

        this.#seen.add(comment)

        continue
      }

      const seeds = SEEDS.exec(data)

      if (seeds) {
        const holder = openItems[openItems.length - 1]?.item ?? openRegions[openRegions.length - 1]?.region ?? this.#enclosingRegion(comment)

        if (holder) holder.seeds = { ...(holder.seeds ?? {}), ...parseSeeds(seeds[1]) }

        this.#seen.add(comment)

        continue
      }

      const branch = BRANCH.exec(data)

      if (branch) {
        const index = Number(branch[1])
        const region = openRegions[openRegions.length - 1]?.region ?? this.#enclosingRegion(comment)
        const item = openItems[openItems.length - 1]?.item ?? (region ? this.#enclosingItem(region, comment) : null)
        const holder = item ?? region
        const slot = openSlots.find((candidate) => candidate.index === index)?.slot ?? holder?.slots.get(index)

        if (slot && /^\d+$/.test(branch[2])) slot.branch = Number(branch[2])

        this.#seen.add(comment)
      }
    }
  }

  #scanSkeletons(root: Node): void {
    for (const element of skeletonElements(root)) {
      const identity = this.#staticsIdentity(element)
      if (!identity) continue

      for (const [key, fragment] of parkedBranches(element)) {
        this.#park(identity, key, fragment)
      }

      element.remove()
    }
  }

  #park(identity: StaticsIdentity, key: string, fragment: DocumentFragment): boolean {
    const { file, version } = identity
    const held = this.#skeletons.get(file)
    const statics = held && held.version === version ? held : { version, fragments: new Map() }

    this.#skeletons.set(file, statics)

    if (statics.fragments.has(key)) return false

    statics.fragments.set(key, fragment)

    return true
  }

  #staticsIdentity(element: HTMLTemplateElement): StaticsIdentity | null {
    const named = element.getAttribute(HERB_ATTRIBUTES.region)

    if (named !== null) {
      const match = STATICS_REGION.exec(named)

      return match ? { file: match[1], version: match[2] } : null
    }

    const region = this.#enclosingRegion(element)

    return region ? { file: region.file, version: region.version } : null
  }

  #nameSlot(element: Element, state: ParseState): void {
    if (this.#named.has(element)) return

    const entry = NAME_ENTRY.exec(element.getAttribute(NAME_ATTRIBUTE) ?? "")

    if (!entry) return

    this.#named.add(element)

    const region = state.openRegions[state.openRegions.length - 1]?.region ?? this.#enclosingRegion(element)

    region?.names.set(entry[2], Number(entry[1]))
  }

  #anchorSlots(element: Element, result: ScanResult, state: ParseState): void {
    if (this.#anchored.has(element)) return

    this.#anchored.add(element)

    const walked = state.openRegions[state.openRegions.length - 1]?.region ?? null
    const region = walked ?? this.#enclosingRegion(element)

    if (!region) return

    const stacked = state.openSlots[state.openSlots.length - 1] ?? null
    const opened = state.openItems[state.openItems.length - 1]?.item ?? null

    const enclosing =
      stacked && stacked.region === region ? stacked.slot : walked ? null : this.#enclosingSlot(region, element)
    const item = opened ?? (walked ? null : this.#enclosingItem(region, element))

    for (const entry of anchorEntries(element)) {
      const [index, type, ...name] = entry.split(":")
      const kind = (type ?? DEFAULT_SLOT_TYPE) === DEFAULT_SLOT_TYPE ? ("content" as const) : ("element" as const)

      this.#attach(
        region,
        {
          index: Number(index),
          type: (type as SlotType) ?? DEFAULT_SLOT_TYPE,
          attribute: name.length > 0 ? name.join(":") : null,
          anchor: { kind, element },
          items: new Map(),
          branch: null,
          parent: null,
          children: [],
        },
        result,
        enclosing,
        item,
      )
    }
  }

  #attach(
    region: Region | null,
    slot: Slot,
    result: ScanResult,
    parent: Slot | null = null,
    item: Item | null = null,
  ): void {
    if (!region) return

    const target = item ? item.slots : region.slots
    const existing = target.get(slot.index)

    if (existing) {
      existing.anchor = slot.anchor
      existing.type = slot.type

      if (parent) link(parent, existing)

      return
    }

    if (parent) link(parent, slot)

    target.set(slot.index, slot)
    this.#slotRegions.set(slot, region)
    this.#slotOwners.set(slot, target)
    result.slots.push(slot)
  }

  #enclosingRegion(node: Node): Region | null {
    for (let i = this.#regions.length - 1; i >= 0; i--) {
      const region = this.#regions[i]

      if (contains(region, node)) return region
    }

    return null
  }

  #forget(slot: Slot): void {
    const owner = this.#slotOwners.get(slot)

    if (owner?.get(slot.index) === slot) owner.delete(slot.index)

    this.#slotRegions.delete(slot)
    this.#slotOwners.delete(slot)

    if (slot.parent) slot.parent.children = slot.parent.children.filter((child) => child !== slot)
  }

  #enclosingItem(region: Region, node: Node): Item | null {
    let innermost: Item | null = null

    for (const slot of this.#everySlot(region)) {
      for (const item of slot.items.values()) {
        if (!withinRange({ start: item.start, end: item.end }, node)) continue

        if (!innermost || withinRange({ start: innermost.start, end: innermost.end }, item.start)) {
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

      for (const item of slot.items.values()) queue.push(...item.slots.values())
    }
  }

  #enclosingSlot(region: Region, node: Node): Slot | null {
    let innermost: Slot | null = null

    for (const slot of this.#everySlot(region)) {
      if (slot.anchor.kind !== "range") continue
      if (!withinRange(slot.anchor, node)) continue

      if (!innermost) {
        innermost = slot
        continue
      }

      const inner = innermost.anchor as { start: Comment; end: Comment }

      if (withinRange(inner, slot.anchor.start)) innermost = slot
    }

    return innermost
  }

  #regionConnected(region: Region): boolean {
    region.ranges = region.ranges.filter((range) => range.start.isConnected)

    region.start = region.ranges[0]?.start ?? null
    region.end = region.ranges[0]?.end ?? null

    return region.ranges.length > 0
  }

  #slotConnected(slot: Slot): boolean {
    return slot.anchor.kind === "range" ? slot.anchor.start.isConnected : slot.anchor.element.isConnected
  }

  *#markers(root: Node): Generator<Comment | Element> {
    if (root.nodeType === Node.COMMENT_NODE) {
      yield root as Comment
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return
    }

    if (root.nodeType === Node.ELEMENT_NODE && (anchored(root as Element) || named(root as Element))) {
      yield root as Element
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        (node.nodeType === Node.COMMENT_NODE
          ? MARKER.test((node as Comment).data.trim())
          : anchored(node as Element) || named(node as Element))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    })

    let node = walker.nextNode()

    while (node) {
      yield node as Comment | Element
      node = walker.nextNode()
    }
  }
}

function parseSeeds(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown

    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function skeletonElements(root: Node): HTMLTemplateElement[] {
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return []
  }

  const parent = root as ParentNode
  const found = [...parent.querySelectorAll(STATICS_SELECTOR)] as HTMLTemplateElement[]

  if (root instanceof HTMLTemplateElement && root.matches(STATICS_SELECTOR)) {
    found.unshift(root)
  }

  return found
}

function attributeParts(fragment: DocumentFragment | null): string[] | null {
  if (!fragment) return null

  const segments: string[] = [""]

  for (const node of fragment.childNodes) {
    if (node.nodeType === Node.COMMENT_NODE) {
      if ((node as Comment).data.trim() === PART_MARKER) segments.push("")

      continue
    }

    segments[segments.length - 1] += node.textContent ?? ""
  }

  return segments.length > 1 ? segments : null
}

function parkedBranches(element: HTMLTemplateElement): FragmentMap {
  const named = element.getAttribute(HERB_ATTRIBUTES.statics)

  if (named !== null) return new Map([[named, element.content]])

  const branches = new Map<string, DocumentFragment>()

  let current: DocumentFragment | null = null

  for (const node of [...element.content.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const branch = BRANCH.exec((node as Comment).data.trim())

      if (branch) {
        current = document.createDocumentFragment()
        branches.set(`${branch[1]}:${branch[2]}`, current)
      }
    }

    current?.append(node)
  }

  return branches
}

function templateNames(template: DocumentFragment): Map<string, number> {
  const names = new Map<string, number>()

  for (const element of template.querySelectorAll(ANCHOR_SELECTOR)) {
    for (const entry of anchorEntries(element)) {
      const [index, , ...name] = entry.split(":")

      if (name.length > 0) names.set(name.join(":"), Number(index))
    }
  }

  for (const element of template.querySelectorAll(`[${NAME_ATTRIBUTE}]`)) {
    const entry = NAME_ENTRY.exec(element.getAttribute(NAME_ATTRIBUTE) ?? "")

    if (entry) names.set(entry[2], Number(entry[1]))
  }

  return names
}

function fillSlots(fragment: DocumentFragment, dynamics: SlotValues, text = false, parts?: (index: number) => string[] | null): void {
  for (const open of slotOpeners(fragment)) {
    const index = Number(SLOT_OPEN.exec(open.data.trim())?.[1])
    const value = dynamics[index]

    if (value === undefined) continue

    if (Array.isArray(value)) continue

    const close = closingFor(open, index)
    if (!close) continue

    const range = document.createRange()

    range.setStartAfter(open)
    range.setEndBefore(close)
    range.deleteContents()
    range.insertNode(range.createContextualFragment(text ? escapeText(value) : value))
  }

  for (const element of fragment.querySelectorAll(ANCHOR_SELECTOR)) {
    for (const entry of anchorEntries(element)) {
      const [index, type, ...name] = entry.split(":")
      const value = dynamics[Number(index)]

      if (value === undefined) continue

      if (name.length > 0) {
        const whole = type === "attribute_interpolation"
          ? interpolateParts(parts?.(Number(index)) ?? null, value)
          : Array.isArray(value) ? null : value

        if (whole !== null) element.setAttribute(name.join(":"), whole)
      } else if ((type ?? DEFAULT_SLOT_TYPE) === DEFAULT_SLOT_TYPE && !Array.isArray(value)) {
        element.innerHTML = text ? escapeText(value) : value
      }
    }
  }
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (match) => (match === "&" ? "&amp;" : match === "<" ? "&lt;" : "&gt;"))
}

function interpolateParts(parts: string[] | null, value: string | string[]): string | null {
  if (!parts) return null

  const dynamics = Array.isArray(value) ? value : [value]

  if (dynamics.length !== parts.length - 1) return null

  return parts.reduce((whole, segment, position) => (position === 0 ? segment : `${whole}${dynamics[position - 1]}${segment}`), "")
}

function blankSlots(fragment: DocumentFragment): void {
  for (const open of slotOpeners(fragment)) {
    if (!fragment.contains(open)) continue

    const close = closingFor(open, Number(SLOT_OPEN.exec(open.data.trim())?.[1]))
    if (!close) continue

    const range = document.createRange()

    range.setStartAfter(open)
    range.setEndBefore(close)
    range.deleteContents()
  }

  for (const element of fragment.querySelectorAll(ANCHOR_SELECTOR)) {
    for (const entry of anchorEntries(element)) {
      const [, type, ...name] = entry.split(":")

      if (name.length > 0) {
        if (type === "boolean_attribute") element.removeAttribute(name.join(":"))
        else element.setAttribute(name.join(":"), "")
      } else if ((type ?? DEFAULT_SLOT_TYPE) === DEFAULT_SLOT_TYPE) {
        element.replaceChildren()
      }
    }
  }
}

function slotOpeners(fragment: DocumentFragment): Comment[] {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT, {
    acceptNode: (node) =>
      SLOT_OPEN.test((node as Comment).data.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })

  const openers: Comment[] = []

  let node = walker.nextNode()

  while (node) {
    openers.push(node as Comment)
    node = walker.nextNode()
  }

  return openers
}

function closingFor(open: Comment, index: number): Comment | null {
  const expected = `/herb-slot:${index}`

  let node: Node | null = open.nextSibling

  while (node) {
    if (node.nodeType === Node.COMMENT_NODE && (node as Comment).data.trim() === expected) {
      return node as Comment
    }

    node = node.nextSibling
  }

  return null
}

function anchorEntries(element: Element): string[] {
  return element.getAttribute(ANCHOR_ATTRIBUTE)?.split(/\s+/).filter(Boolean) ?? []
}

function named(element: Element): boolean {
  return element.hasAttribute(NAME_ATTRIBUTE)
}

function anchored(element: Element): boolean {
  return element.hasAttribute(ANCHOR_ATTRIBUTE)
}

function contains(region: Region, node: Node): boolean {
  return region.ranges.some((range) => withinRegionRange(range, node))
}

function withinRegionRange(range: RegionRange, node: Node): boolean {
  const after = range.start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
  if (!after) return false

  if (!range.end) return true

  return Boolean(range.end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)
}

function withinRange(anchor: { start: Comment; end: Comment }, node: Node): boolean {
  const after = anchor.start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
  const before = anchor.end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING

  return Boolean(after && before)
}

function link(parent: Slot | null, child: Slot): void {
  if (!parent || parent === child) return

  child.parent = parent

  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

function isPayload(value: PayloadValue): value is Payload {
  return typeof value === "object" && "template" in value
}

function leaves(values: PayloadSlots | undefined): SlotValues {
  const filled: SlotValues = {}

  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === "string") filled[Number(key)] = value
  }

  return filled
}

function popMatching<T>(open: T[], matches: (candidate: T) => boolean): T | null {
  for (let i = open.length - 1; i >= 0; i--) {
    if (matches(open[i])) return open.splice(i, 1)[0]
  }

  return null
}
