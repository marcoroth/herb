/**
 * An index over the slot markers `Herb::Engine::SlotVisitor` emits, so a client can find a
 * template's dynamic parts again after the page has rendered.
 *
 * Three properties of the markup drive the shape of this:
 *
 *   - Comments are not reachable by `querySelectorAll`, so ranges are found with a `TreeWalker`.
 *     Element-anchored slots are attributes and use the cheap selector path.
 *   - A marker pair is not necessarily a pair of siblings. The HTML parser inserts a `<tbody>`
 *     into a `<table>` and moves the rows into it, leaving the markers that preceded them
 *     behind, so a row's opening and closing marker can sit at different depths. Pairing is by
 *     index on a stack, never by walking siblings.
 *   - One template can be on the page many times, so a file maps to a list of regions rather
 *     than to one.
 *
 * Scanning is incremental. `scan` takes whatever subtree just arrived and adds what it finds,
 * attaching slots to an already-indexed region when the new markup landed inside one.
 */

const REGION_OPEN = /^herb-region:(.*):([0-9a-f]+):(\d+)$/
const REGION_CLOSE = /^\/herb-region:(.*)$/
const SLOT_OPEN = /^herb-slot:(\d+)(?::([a-z_]+))?$/
const SLOT_CLOSE = /^\/herb-slot:(\d+)$/
const ROW_OPEN = /^herb-row:(\d+):([\s\S]*)$/
const ROW_CLOSE = /^\/herb-row:(\d+)$/
const BRANCH = /^herb-branch:(\d+):(\d+)$/
const MARKER = /^\/?herb-(region|slot|row|branch):/
const STATICS_REGION = /^(.*):([0-9a-f]+)$/
const STATICS_SELECTOR = "template[data-herb-region], template[data-herb-statics]"

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

export interface Row {
  key: string
  start: Comment
  end: Comment
  slots: Map<number, Slot>
}

export interface Slot {
  index: number
  type: SlotType
  attribute: string | null
  anchor: SlotAnchor
  rows: Map<string, Row>
  branch: number | null
  parent: Slot | null
  children: Slot[]
}

export interface RegionRange {
  start: Comment
  end: Comment | null
}

/**
 * One rendering of one template. Usually one stretch of the page, but not always: `content_for`
 * and `capture` write markup during a rendering and emit it somewhere else entirely, so a rendering
 * is identified by the template and the number it was rendered as, and may cover several stretches.
 */
export interface Region {
  file: string
  version: string
  occurrence: number
  ranges: RegionRange[]
  start: Comment | null
  end: Comment | null
  slots: Map<number, Slot>
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
  rows: { [key: string]: PayloadSlots }
}

export type PayloadValue = string | Payload | Branched | Collected

export type DeferredReason = "no-region" | "stale-version" | "no-slot" | "branch" | "rows"

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
}

export interface RowPlan {
  added: string[]
  removed: string[]
  moved: string[]
  kept: string[]
  unchanged: boolean
}

interface Statics {
  version: string
  fragments: Map<string, DocumentFragment>
}

interface OpenSlot {
  index: number
  slot: Slot
  region: Region | null
}

interface OpenRow {
  slot: number
  row: Row
}

interface OpenRegion {
  region: Region
  range: RegionRange
}

interface ParseState {
  openRegions: OpenRegion[]
  openSlots: OpenSlot[]
  openRows: OpenRow[]
}

export class SlotIndex {
  #regions: Region[] = []
  #seen = new WeakSet<Comment>()
  #anchored = new WeakSet<Element>()
  #slotRegions = new WeakMap<Slot, Region>()
  #slotOwners = new WeakMap<Slot, Map<number, Slot>>()
  #skeletons = new Map<string, Statics>()
  #observer: MutationObserver | null = null

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
    const state: ParseState = { openRegions: [], openSlots: [], openRows: [] }
    const list = Array.isArray(roots) ? roots : [roots]

    for (const root of list) this.#scanComments(root, result, state)
    for (const root of list) this.#scanSkeletons(root)
    for (const root of list) this.#scanAnchors(root, result)

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

  slot(file: string, index: number, occurrence = 0): Slot | null {
    return this.region(file, occurrence)?.slots.get(index) ?? null
  }

  rowsFor(file: string, index: number, occurrence = 0): Map<string, Row> {
    return this.slot(file, index, occurrence)?.rows ?? new Map()
  }

  slotInRow(file: string, collection: number, key: string, index: number, occurrence = 0): Slot | null {
    return this.rowsFor(file, collection, occurrence).get(key)?.slots.get(index) ?? null
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

  rangeForRow(row: Row): Range {
    const range = document.createRange()

    range.setStartAfter(row.start)
    range.setEndBefore(row.end)

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

  reconcile(slot: Slot, keys: string[]): RowPlan {
    const present = this.#rowsInDocumentOrder(slot).map((row) => row.key)
    const wanted = new Set(keys)

    const removed = present.filter((key) => !wanted.has(key))
    const added = keys.filter((key) => !present.includes(key))
    const kept = keys.filter((key) => present.includes(key))
    const order = present.filter((key) => wanted.has(key))
    const moved = kept.filter((key, position) => order[position] !== key)

    return { added, removed, moved, kept, unchanged: added.length === 0 && removed.length === 0 && moved.length === 0 }
  }

  apply(payload: Payload): ApplyReport {
    const report: ApplyReport = { applied: 0, deferred: [] }

    this.#applyPayload(payload, report)

    return report
  }

  #applyPayload(payload: Payload, report: ApplyReport): void {
    const region = this.region(payload.template, payload.occurrence)

    if (!region) return this.#defer(report, payload, null, "no-region")
    if (region.version !== payload.version) return this.#defer(report, payload, null, "stale-version")

    this.#applySlots(payload, region.slots, payload.slots, report)
  }

  #applySlots(payload: Payload, owner: Map<number, Slot>, values: PayloadSlots, report: ApplyReport): void {
    for (const [key, value] of Object.entries(values)) {
      if (isPayload(value)) {
        this.#applyPayload(value, report)
        continue
      }

      const index = Number(key)
      const slot = owner.get(index)

      if (!slot) {
        this.#defer(report, payload, index, "no-slot")
        continue
      }

      if (typeof value === "string") {
        if (slot.attribute) this.setAttribute(slot, value)
        else this.update(slot, value)

        report.applied += 1
        continue
      }

      if ("rows" in value) this.#applyRows(payload, slot, value, report)
      else this.#applyBranch(payload, slot, value, report)
    }
  }

  #applyBranch(payload: Payload, slot: Slot, value: Branched, report: ApplyReport): void {
    if (value.branch === slot.branch) {
      if (value.slots) this.#applySlots(payload, this.#owner(slot), value.slots, report)

      return
    }

    if (value.branch === null) {
      this.update(slot, "")
      slot.branch = null
      report.applied += 1

      return
    }

    const built = this.materialize(payload.template, `${slot.index}:${value.branch}`, leaves(value.slots))

    if (!built) return this.#defer(report, payload, slot.index, "branch")

    this.#writeFragment(slot, built)

    report.applied += 1
  }

  #applyRows(payload: Payload, slot: Slot, value: Collected, report: ApplyReport): void {
    const keys = Object.keys(value.rows)
    const plan = this.reconcile(slot, keys)

    if (!plan.unchanged) this.#defer(report, payload, slot.index, "rows", [...plan.added, ...plan.removed, ...plan.moved])

    for (const key of plan.kept) {
      const row = slot.rows.get(key)

      if (row) this.#applySlots(payload, row.slots, value.rows[key], report)
    }
  }

  #writeFragment(slot: Slot, fragment: DocumentFragment): void {
    for (const descendant of this.descendantsOf(slot)) this.#forget(descendant)

    slot.children = []

    const range = this.rangeFor(slot)

    range.deleteContents()

    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    this.scan(added)
  }

  #owner(slot: Slot): Map<number, Slot> {
    return this.#slotOwners.get(slot) ?? this.#slotRegions.get(slot)?.slots ?? new Map()
  }

  #defer(report: ApplyReport, payload: Payload, index: number | null, reason: DeferredReason, keys?: string[]): void {
    report.deferred.push({ file: payload.template, occurrence: payload.occurrence, index, reason, ...(keys ? { keys } : {}) })
  }

  update(slot: Slot, html: string): ScanResult {
    for (const descendant of this.descendantsOf(slot)) this.#forget(descendant)

    slot.children = []

    if (slot.anchor.kind === "element") {
      const replacement = this.rangeFor(slot).createContextualFragment(html)
      const element = slot.anchor.element

      element.replaceWith(replacement)
      this.#forget(slot)

      return this.scan([...(element.parentNode?.childNodes ?? [])])
    }

    const range = this.rangeFor(slot)

    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    return this.scan(added)
  }

  updateRow(slot: Slot, key: string, html: string): ScanResult | null {
    const row = slot.rows.get(key)
    if (!row) return null

    const range = this.rangeForRow(row)

    range.deleteContents()

    const fragment = range.createContextualFragment(html)
    const added = [...fragment.childNodes]

    range.insertNode(fragment)

    return this.scan(added)
  }

  setAttribute(slot: Slot, value: string | null, name = slot.attribute): boolean {
    if (slot.anchor.kind === "range" || name === null) return false

    if (value === null) {
      slot.anchor.element.removeAttribute(name)
    } else {
      slot.anchor.element.setAttribute(name, value)
    }

    return true
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
      .map((key) => Number(key.slice(prefix.length)))
      .sort((a, b) => a - b)
  }

  renderModeFor(file: string, slot?: number): RenderMode {
    if (slot === undefined) {
      return this.skeletonKeys(file).length > 0 ? "client" : "server"
    }

    return this.branchesFor(file, slot).length > 0 ? "client" : "server"
  }

  materialize(file: string, key: string, dynamics: Record<number, string> = {}): DocumentFragment | null {
    const skeleton = this.skeletonFor(file, key)
    if (!skeleton) return null

    const copy = skeleton.cloneNode(true) as DocumentFragment

    fillSlots(copy, dynamics)

    return copy
  }

  prune(): number {
    const before = this.#regions.length

    this.#regions = this.#regions.filter((region) => this.#regionConnected(region))

    for (const region of this.#regions) {
      for (const [index, slot] of region.slots) {
        if (this.#slotConnected(slot)) this.#pruneRows(slot)
        else region.slots.delete(index)
      }
    }

    return before - this.#regions.length
  }

  #pruneRows(slot: Slot): void {
    if (slot.rows.size === 0) return

    const live = this.#rowsInDocumentOrder(slot)

    slot.rows.clear()

    for (const row of live) {
      for (const [index, nested] of row.slots) {
        if (!this.#slotConnected(nested)) row.slots.delete(index)
        else this.#pruneRows(nested)
      }

      slot.rows.set(row.key, row)
    }
  }

  #rowsInDocumentOrder(slot: Slot): Row[] {
    return [...slot.rows.values()]
      .filter((row) => row.start.isConnected)
      .sort((left, right) =>
        left.start.compareDocumentPosition(right.start) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
  }

  clear(): void {
    this.#regions = []
    this.#seen = new WeakSet()
    this.#anchored = new WeakSet()
    this.#skeletons = new Map()
  }

  get size(): number {
    return this.#regions.reduce((total, region) => total + region.slots.size, 0)
  }

  #scanComments(root: Node, result: ScanResult, state: ParseState): void {
    const { openRegions, openSlots, openRows } = state

    for (const comment of this.#comments(root)) {
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
          rows: new Map(),
          branch: null,
          parent: null,
          children: [],
        }

        openSlots.push({ index: slot.index, slot, region })

        this.#attach(region, slot, result, enclosing, openRows[openRows.length - 1]?.row ?? null)
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

      const rowOpen = ROW_OPEN.exec(data)

      if (rowOpen) {
        const collectionIndex = Number(rowOpen[1])
        const region = openRegions[openRegions.length - 1]?.region ?? this.#enclosingRegion(comment)
        const collection = region?.slots.get(collectionIndex)
        const row: Row = { key: rowOpen[2], start: comment, end: comment, slots: new Map() }

        collection?.rows.set(row.key, row)
        openRows.push({ slot: collectionIndex, row })
        this.#seen.add(comment)

        continue
      }

      const rowClose = ROW_CLOSE.exec(data)

      if (rowClose) {
        const open = popMatching(openRows, (candidate) => candidate.slot === Number(rowClose[1]))

        if (open) open.row.end = comment

        this.#seen.add(comment)

        continue
      }

      const branch = BRANCH.exec(data)

      if (branch) {
        const region = openRegions[openRegions.length - 1]?.region ?? this.#enclosingRegion(comment)
        const slot = region?.slots.get(Number(branch[1]))

        if (slot) slot.branch = Number(branch[2])

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

  #park(identity: { file: string; version: string }, key: string, fragment: DocumentFragment): boolean {
    const { file, version } = identity
    const held = this.#skeletons.get(file)
    const statics = held && held.version === version ? held : { version, fragments: new Map() }

    this.#skeletons.set(file, statics)

    if (statics.fragments.has(key)) return false

    statics.fragments.set(key, fragment)

    return true
  }

  #staticsIdentity(element: HTMLTemplateElement): { file: string; version: string } | null {
    const named = element.getAttribute("data-herb-region")

    if (named !== null) {
      const match = STATICS_REGION.exec(named)

      return match ? { file: match[1], version: match[2] } : null
    }

    const region = this.#enclosingRegion(element)

    return region ? { file: region.file, version: region.version } : null
  }

  #scanAnchors(root: Node, result: ScanResult): void {
    for (const element of anchorElements(root)) {
      if (this.#anchored.has(element)) continue

      this.#anchored.add(element)

      const region = this.#enclosingRegion(element)
      if (!region) continue

      const enclosing = this.#enclosingSlot(region, element)
      const row = this.#enclosingRow(region, element)
      const anchors = element.getAttribute("data-herb-slot")

      for (const entry of anchors?.split(",") ?? []) {
        const [index, type, ...name] = entry.split(":")

        this.#attach(
          region,
          {
            index: Number(index),
            type: (type as SlotType) ?? DEFAULT_SLOT_TYPE,
            attribute: name.length > 0 ? name.join(":") : null,
            anchor: { kind: "element", element },
            rows: new Map(),
            branch: null,
            parent: null,
            children: [],
          },
          result,
          enclosing,
          row,
        )
      }

      const child = element.getAttribute("data-herb-child")

      if (child !== null) {
        this.#attach(
          region,
          {
            index: Number(child),
            type: DEFAULT_SLOT_TYPE,
            attribute: null,
            anchor: { kind: "content", element },
            rows: new Map(),
            branch: null,
            parent: null,
            children: [],
          },
          result,
          enclosing,
          row,
        )
      }
    }
  }

  #attach(
    region: Region | null,
    slot: Slot,
    result: ScanResult,
    parent: Slot | null = null,
    row: Row | null = null,
  ): void {
    if (!region) return

    const target = row ? row.slots : region.slots
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

  #enclosingRow(region: Region, node: Node): Row | null {
    let innermost: Row | null = null

    for (const slot of this.#everySlot(region)) {
      for (const row of slot.rows.values()) {
        if (!withinRange({ start: row.start, end: row.end }, node)) continue

        if (!innermost || withinRange({ start: innermost.start, end: innermost.end }, row.start)) {
          innermost = row
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

      for (const row of slot.rows.values()) queue.push(...row.slots.values())
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

  *#comments(root: Node): Generator<Comment> {
    if (root.nodeType === Node.COMMENT_NODE) {
      yield root as Comment
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, {
      acceptNode: (node) =>
        MARKER.test((node as Comment).data.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    })

    let node = walker.nextNode()

    while (node) {
      yield node as Comment
      node = walker.nextNode()
    }
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

function parkedBranches(element: HTMLTemplateElement): Map<string, DocumentFragment> {
  const named = element.getAttribute("data-herb-statics")

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

function fillSlots(fragment: DocumentFragment, dynamics: Record<number, string>): void {
  for (const open of slotOpeners(fragment)) {
    const index = Number(SLOT_OPEN.exec(open.data.trim())?.[1])
    const value = dynamics[index]

    if (value === undefined) continue

    const close = closingFor(open, index)
    if (!close) continue

    const range = document.createRange()

    range.setStartAfter(open)
    range.setEndBefore(close)
    range.deleteContents()
    range.insertNode(range.createContextualFragment(value))
  }

  for (const element of fragment.querySelectorAll("[data-herb-slot], [data-herb-child]")) {
    for (const entry of element.getAttribute("data-herb-slot")?.split(",") ?? []) {
      const [index, , ...name] = entry.split(":")
      const value = dynamics[Number(index)]

      if (value !== undefined && name.length > 0) element.setAttribute(name.join(":"), value)
    }

    const child = element.getAttribute("data-herb-child")
    const value = child === null ? undefined : dynamics[Number(child)]

    if (value !== undefined) element.innerHTML = value
  }
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

  for (const element of fragment.querySelectorAll("[data-herb-slot], [data-herb-child]")) {
    for (const entry of element.getAttribute("data-herb-slot")?.split(",") ?? []) {
      const [, , ...name] = entry.split(":")

      if (name.length > 0) {
        element.setAttribute(name.join(":"), "")
      }
    }

    if (element.hasAttribute("data-herb-child")) element.replaceChildren()
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

function anchorElements(root: Node): Element[] {
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return []
  }

  const parent = root as ParentNode
  const found = [...parent.querySelectorAll("[data-herb-slot],[data-herb-child]")]

  if (root.nodeType === Node.ELEMENT_NODE) {
    const element = root as Element

    if (element.hasAttribute("data-herb-slot") || element.hasAttribute("data-herb-child")) {
      found.unshift(element)
    }
  }

  return found
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

function leaves(values: PayloadSlots | undefined): Record<number, string> {
  const filled: Record<number, string> = {}

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
