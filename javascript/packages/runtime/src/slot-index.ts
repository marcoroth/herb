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

const REGION_OPEN = /^herb-region:(.*):([0-9a-f]+)$/
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

export interface Region {
  file: string
  version: string
  start: Comment | null
  end: Comment | null
  slots: Map<number, Slot>
}

export interface ScanResult {
  regions: Region[]
  slots: Slot[]
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

interface ParseState {
  openRegions: Region[]
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

  /**
   * Keeps the index current as the server sends markup. A record reports only the top of an
   * added subtree, never its descendants, so what it names is scanned rather than read. The
   * whole batch goes to one `scan` because a template's markers arrive as many sibling nodes
   * of the same record.
   */
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

  /**
   * Reads every marker under `roots` and adds what it finds. Safe to call repeatedly on
   * overlapping subtrees: a marker already indexed is skipped rather than duplicated.
   *
   * Takes a list because setting `innerHTML` adds a template's markers as many sibling nodes
   * at once. A slot's opening marker and the rows inside it can land in different nodes of the
   * same batch, so they are read as one sequence rather than one node at a time.
   */
  scan(roots: Node | Node[]): ScanResult {
    const result: ScanResult = { regions: [], slots: [] }
    const state: ParseState = { openRegions: [], openSlots: [], openRows: [] }
    const list = Array.isArray(roots) ? roots : [roots]

    for (const root of list) this.#scanComments(root, result, state)
    for (const root of list) this.#scanSkeletons(root)
    for (const root of list) this.#scanAnchors(root, result)

    return result
  }

  /** Every region for a template, in document order, one per time it was rendered. */
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

  slot(file: string, index: number, occurrence = 0): Slot | null {
    return this.regionsFor(file)[occurrence]?.slots.get(index) ?? null
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

  /**
   * What has to happen to the rows on the page for them to match `keys`. Keys the server sent
   * are matched against the keys already rendered, so a reorder moves rows rather than
   * rebuilding them, which is the whole point of keying a collection.
   */
  reconcile(slot: Slot, keys: string[]): RowPlan {
    const present = [...slot.rows.keys()]
    const wanted = new Set(keys)

    const removed = present.filter((key) => !wanted.has(key))
    const added = keys.filter((key) => !slot.rows.has(key))
    const kept = keys.filter((key) => slot.rows.has(key))
    const order = present.filter((key) => wanted.has(key))
    const moved = kept.filter((key, position) => order[position] !== key)

    return { added, removed, moved, kept, unchanged: added.length === 0 && removed.length === 0 && moved.length === 0 }
  }

  /**
   * Replaces what a slot covers with new markup and re-indexes it.
   *
   * The fragment is parsed against the range rather than through a detached element, because
   * the parser needs the surrounding context: `<tr>` outside a table is dropped, and a
   * collection's rows are exactly the case this gets used for.
   */
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

  /**
   * Keeps what a branch rendered, as the markup for building it again.
   *
   * A branch that rendered is on the page rather than parked, because sending it twice would be
   * sending it twice. That leaves nothing to build it from once it has been replaced, so this
   * takes a copy of it first, with the values emptied out of it, and registers it exactly as a
   * parked one. Call it before an update that replaces a branch, and no branch is ever lost.
   */
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

  /**
   * Where a part of a template can be rendered. The server decides this per template and may
   * decide it per slot, so a file that sent statics for one conditional and left another to the
   * server is answered `client` for the first and `server` for the second. `server` is what a
   * page that sent no statics at all reports, which is also what an index that has not seen the
   * template yet reports, so the caller asks the server either way.
   */
  renderModeFor(file: string, slot?: number): RenderMode {
    if (slot === undefined) {
      return this.skeletonKeys(file).length > 0 ? "client" : "server"
    }

    return this.branchesFor(file, slot).length > 0 ? "client" : "server"
  }

  /**
   * Builds the markup for something that has not rendered yet, from its parked skeleton and the
   * values the server sent for it. Nothing is fetched: the statics were already on the page, so
   * a branch appearing for the first time costs only its dynamics.
   */
  materialize(file: string, key: string, dynamics: Record<number, string> = {}): DocumentFragment | null {
    const skeleton = this.skeletonFor(file, key)
    if (!skeleton) return null

    const copy = skeleton.cloneNode(true) as DocumentFragment

    fillSlots(copy, dynamics)

    return copy
  }

  /**
   * Drops everything no longer in the document. Returns how many regions went.
   *
   * Parked statics stay. They are held as fragments rather than as nodes in the page, so they
   * are not what a removal was about, and a template whose last rendering has left is the case
   * where having kept them pays: the next one renders without asking the server for markup it
   * has already sent.
   */
  prune(): number {
    const before = this.#regions.length

    this.#regions = this.#regions.filter((region) => this.#regionConnected(region))

    for (const region of this.#regions) {
      for (const [index, slot] of region.slots) {
        if (!this.#slotConnected(slot)) region.slots.delete(index)
      }
    }

    return before - this.#regions.length
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
        const region: Region = {
          file: regionOpen[1],
          version: regionOpen[2],
          start: comment,
          end: null,
          slots: new Map(),
        }

        openRegions.push(region)
        this.#regions.push(region)
        result.regions.push(region)
        this.#seen.add(comment)

        continue
      }

      const regionClose = REGION_CLOSE.exec(data)

      if (regionClose) {
        const region = popMatching(openRegions, (candidate) => candidate.file === regionClose[1])

        if (region) region.end = comment

        this.#seen.add(comment)

        continue
      }

      const slotOpen = SLOT_OPEN.exec(data)

      if (slotOpen) {
        const region = openRegions[openRegions.length - 1] ?? this.#enclosingRegion(comment)
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
        const region = openRegions[openRegions.length - 1] ?? this.#enclosingRegion(comment)
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
        const region = openRegions[openRegions.length - 1] ?? this.#enclosingRegion(comment)
        const slot = region?.slots.get(Number(branch[1]))

        if (slot) slot.branch = Number(branch[2])

        this.#seen.add(comment)
      }
    }
  }

  /**
   * Markup for parts of a template that did not render, parked in a `<template>` so the client
   * has them without a round trip. A `<template>`'s content is a separate fragment, so nothing
   * inside one is addressable until it is put into the document.
   *
   * How much a rendering parks is the server's call and can differ between two renderings of
   * the same template, so what arrives is merged rather than treated as the whole set. A
   * rendering of a version the index has not seen replaces what it held, because statics
   * compiled from one version of a template say nothing about the next.
   *
   * Each one is taken out of the document once it has been read. One delivered inside its
   * region sits inside the range of that region and of any slot spanning it, and an update over
   * that span would otherwise copy it into the page or destroy it. A `<template>` keeps its
   * content when it leaves the document, so what is registered survives the removal.
   */
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

  /**
   * Statics belong to the template, so a template rendered many times contributes one copy, and
   * what the server sent is what a copy taken off the page defers to.
   */
  #park(identity: { file: string; version: string }, key: string, fragment: DocumentFragment): boolean {
    const { file, version } = identity
    const held = this.#skeletons.get(file)
    const statics = held && held.version === version ? held : { version, fragments: new Map() }

    this.#skeletons.set(file, statics)

    if (statics.fragments.has(key)) return false

    statics.fragments.set(key, fragment)

    return true
  }

  /**
   * Which template a parked `<template>` belongs to. Naming its own region frees it from where
   * it sits, so a template rendered many times can park its statics once for the page rather
   * than once per rendering, and the parser moving it is of no consequence. Saying nothing
   * falls back to the region it was delivered in.
   */
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

  /**
   * Markup that arrives on its own carries no region marker, so the region it belongs to is
   * whichever indexed one already surrounds it.
   */
  #enclosingRegion(node: Node): Region | null {
    for (let i = this.#regions.length - 1; i >= 0; i--) {
      const region = this.#regions[i]

      if (region.start && contains(region, node)) return region
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
    return region.start ? region.start.isConnected : false
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

/**
 * The branches a parked `<template>` carries, split out of one payload.
 *
 * Which branch is which is already written in the payload, because the branch marker is what
 * the rendered output carries too and what tells a slot which branch it is showing. Reading the
 * keys from there rather than from an attribute lets one `<template>` hold everything a
 * template parked, and keeps the two from disagreeing.
 *
 * A branch runs to the next branch marker among the payload's own children. A marker deeper in
 * the tree belongs to a conditional inside a branch, and stays with the branch containing it.
 */
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
}

/**
 * Empties every slot in a copy of something that rendered, leaving the markup around them.
 *
 * What separates a copy taken off the page from what the server would have parked is that the
 * page's copy has values in it. A value left behind is worse than an empty one: an empty slot
 * reads as missing, where a stale one reads as current. Attributes are the reason the marker
 * names them, since an attribute slot has no range to empty and nothing else says what it wrote.
 */
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
  if (!region.start) return false

  const after = region.start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
  if (!after) return false

  if (!region.end) return true

  return Boolean(region.end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)
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

function popMatching<T>(open: T[], matches: (candidate: T) => boolean): T | null {
  for (let i = open.length - 1; i >= 0; i--) {
    if (matches(open[i])) return open.splice(i, 1)[0]
  }

  return null
}
