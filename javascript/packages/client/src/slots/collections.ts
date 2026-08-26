import { ITEM_STATICS } from "../markup/markers"

import { connected, markers, outerRange } from "../markup/anchors"
import { attributeNames, blankSlots, fillSlots } from "../markup/fragments"
import { itemMarker, itemStaticsKey, parseMarker } from "../markup/markers"

import type { Journal } from "./journal"
import type { Manifests } from "./manifests"
import type { Statics } from "./statics"
import type { AddItemOptions, ApplyMode, BuildCause, Item, ItemPlan, ItemValues, PartsResolver, ScanContext, ScanResult, Slot, SlotValues } from "../types"

const NUMERIC_NAME = /^\d+$/

export interface CollectionsDelegate {
  building<T>(cause: BuildCause, work: () => T): T
  scan(roots: Node | Node[], context?: ScanContext): ScanResult
  recordBuilt(slot: Slot, item: Item): void
  announceItemAdded(slot: Slot, key: string, item: Item | null): void
  announceItemRemoved(slot: Slot, key: string, item: Item | null): void
  announceItemRekeyed(slot: Slot, key: string, previousKey: string, item: Item | null): void
}

export class Collections {
  private delegate: CollectionsDelegate
  private journal: Journal
  private statics: Statics
  private manifests: Manifests

  constructor(delegate: CollectionsDelegate, journal: Journal, statics: Statics, manifests: Manifests) {
    this.delegate = delegate
    this.journal = journal
    this.statics = statics
    this.manifests = manifests
  }

  reconcile(slot: Slot, keys: string[]): ItemPlan {
    const present = this.itemsInDocumentOrder(slot).map((item) => item.key)
    const wanted = new Set(keys)

    const removed = present.filter((key) => !wanted.has(key))
    const added = keys.filter((key) => !present.includes(key))
    const kept = keys.filter((key) => present.includes(key))
    const order = present.filter((key) => wanted.has(key))
    const moved = kept.filter((key, position) => order[position] !== key)
    const unchanged = added.length === 0 && removed.length === 0 && moved.length === 0

    return { added, removed, moved, kept, unchanged }
  }

  private mergeItems(slot: Slot, wanted: string[]): string[] {
    const added = wanted.filter((key) => !slot.items.has(key))

    if (added.length === 0) {
      return []
    }

    const template = this.rowTemplate(slot)
    const anchor = this.itemsEnd(slot)

    if (!template || !anchor) {
      return added
    }

    for (const key of added) {
      this.buildItem(slot, key, template, anchor)
    }

    return []
  }

  reconcileItems(slot: Slot, wanted: string[], mode: ApplyMode = "replace"): string[] {
    return this.delegate.building("client", () => {
      if (mode === "merge") {
        return this.mergeItems(slot, wanted)
      }

      const plan = this.reconcile(slot, wanted)

      return plan.unchanged ? [] : this.applyPlan(slot, wanted, plan)
    })
  }

  private applyPlan(slot: Slot, wanted: string[], plan: ItemPlan): string[] {
    let template: DocumentFragment | null = null

    if (plan.added.length > 0) {
      template = this.rowTemplate(slot)
    }

    for (const key of plan.removed) {
      const item = slot.items.get(key)

      if (item) {
        this.dropItem(slot, item)
      }
    }

    if (!template) {
      this.order(slot, wanted.filter((key) => slot.items.has(key)))

      return plan.added
    }

    for (const key of plan.added) {
      this.buildItem(slot, key, template)
    }

    this.order(slot, wanted)

    return []
  }

  private rowTemplate(slot: Slot): DocumentFragment | null {
    const statics = this.statics.parked(slot.region.file, itemStaticsKey(slot.index))

    if (statics) {
      return statics
    }

    const [item] = this.itemsInDocumentOrder(slot)

    if (!item) {
      return null
    }

    return this.rowFragment(item)
  }

  private rowFragment(item: Item): DocumentFragment {
    const fragment = document.createRange().createContextualFragment("")

    fragment.append(outerRange(item).cloneContents())

    blankSlots(fragment)

    return fragment
  }

  private keepItem(slot: Slot, item: Item): void {
    if (slot.items.size > 1) {
      return
    }

    this.statics.park(slot.region, itemStaticsKey(slot.index), this.rowFragment(item))
  }

  private buildItem(slot: Slot, key: string, template: DocumentFragment, anchor?: Node | null, values: SlotValues = {}, text = false): void {
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

    fillSlots(copy, values, text, this.partsResolver(slot))

    const added = [...copy.childNodes]
    const target = this.insertionPoint(slot, anchor)

    if (!target) {
      return
    }

    target.parentNode?.insertBefore(copy, target)

    this.delegate.scan(added, { region: slot.region, slot, item: slot.item })

    this.journal.record(slot, () => (live) => {
      const made = live.items.get(key)

      if (made) {
        this.dropItem(live, made)
      }
    })

    const item = slot.items.get(key) ?? null

    if (item) {
      this.delegate.recordBuilt(slot, item)
    }

    this.delegate.announceItemAdded(slot, key, item)
  }

  private insertionPoint(slot: Slot, anchor?: Node | null): Node | null {
    if (anchor) {
      return anchor
    }

    const [first] = this.itemsInDocumentOrder(slot)

    if (first) {
      return first.start
    }

    return this.itemsEnd(slot)
  }

  private itemsEnd(slot: Slot): Comment | null {
    if (slot.anchor.kind !== "range") {
      return null
    }

    return slot.anchor.end
  }

  private partsResolver(slot: Slot): PartsResolver {
    return (index) => this.manifests.partsOf(slot.region.file, slot.region.version, index)
  }

  private dropItem(slot: Slot, item: Item): void {
    this.journal.record(slot, () => {
      const fragment = outerRange(item).cloneContents()
      const following = this.itemsInDocumentOrder(slot)
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

        this.delegate.scan(added, { region: live.region, slot: live, item: live.item })

        this.delegate.announceItemAdded(live, item.key, live.items.get(item.key) ?? null)
      }
    })

    this.keepItem(slot, item)
    this.delegate.announceItemRemoved(slot, item.key, item)

    outerRange(item).deleteContents()

    slot.items.delete(item.key)
  }

  private order(slot: Slot, keys: string[]): void {
    const end = this.itemsEnd(slot)

    if (!end) {
      return
    }

    this.journal.record(slot, () => {
      const before = this.itemsInDocumentOrder(slot).map((item) => item.key)

      return (live) => {
        this.order(live, before)
      }
    })

    for (const key of keys) {
      const item = slot.items.get(key)

      if (!item) {
        continue
      }

      end.parentNode?.insertBefore(outerRange(item).extractContents(), end)
    }

    this.pruneItems(slot)
  }

  addItem(slot: Slot, key: string, options: AddItemOptions = {}): Item | null {
    if (slot.type !== "collection") {
      return null
    }

    const end = this.itemsEnd(slot)

    if (!end || slot.items.has(key)) {
      return null
    }

    const template = this.rowTemplate(slot)

    if (!template) {
      return null
    }

    let anchor = end

    if (options.before !== undefined) {
      anchor = slot.items.get(options.before)?.start ?? end
    }

    const values = this.itemValues(slot, template, options.values ?? {})

    this.delegate.building("client", () => {
      this.buildItem(slot, key, template, anchor, values, options.text === true)
    })

    return slot.items.get(key) ?? null
  }

  removeItem(slot: Slot, key: string): boolean {
    const item = slot.items.get(key)

    if (!item) {
      return false
    }

    this.dropItem(slot, item)

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

    this.journal.record(slot, () => (live) => {
      this.rekeyItem(live, to, from)
    })

    this.delegate.announceItemRekeyed(slot, to, from, item)

    return true
  }

  private itemValues(slot: Slot, template: DocumentFragment, values: ItemValues): SlotValues {
    const attributes = attributeNames(template)
    const resolved: SlotValues = {}

    for (const [given, value] of Object.entries(values)) {
      if (NUMERIC_NAME.test(given)) {
        resolved[Number(given)] = value

        continue
      }

      const index = this.manifests.nameOf(slot.region.file, slot.region.version, given) ?? attributes.get(given) ?? null

      if (index !== null) {
        resolved[index] = value
      }
    }

    return resolved
  }

  pruneItems(slot: Slot): void {
    if (slot.items.size === 0) {
      return
    }

    const live = this.itemsInDocumentOrder(slot)

    slot.items.clear()

    for (const item of live) {
      for (const [index, nested] of item.slots) {
        if (connected(nested.anchor)) {
          this.pruneItems(nested)
        } else {
          item.slots.delete(index)
        }
      }

      slot.items.set(item.key, item)
    }
  }

  private itemsInDocumentOrder(slot: Slot): Item[] {
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
}
