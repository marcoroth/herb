import { anchorEntries, anchorKind, markers, parseMarker, parseStaticsKey, regionOpenMarker } from "@herb-tools/client"

import type { Region, Slot, Slots } from "@herb-tools/client"

export interface ReshapeOptions {
  version: string
  staticMarkup: string
  changedStatics?: Set<string>
  onMutation?: (node: Node) => void
  onRemoval?: (rect: { top: number; left: number; width: number; height: number }) => void
}

interface Mutation {
  apply: () => void
  target: Node
  removed?: Node
}

interface Level {
  live: Node[]
  next: Node[]
  append: (node: Node) => void
}

type Holder = Map<number, Slot>

export function reshapeRegion(slots: Slots, region: Region, options: ReshapeOptions): boolean {
  if (region.ranges.length !== 1) {
    return false
  }

  const range = region.ranges[0]

  if (!range.end || !range.start.isConnected || !range.end.isConnected) {
    return false
  }

  const parser = document.createRange()

  parser.setStartAfter(range.start)

  const fragment = parser.createContextualFragment(options.staticMarkup)
  const mutations: Mutation[] = []
  const end = range.end

  const matched = walk({
    live: siblingsBetween(range.start, end),
    next: [...fragment.childNodes],
    append: (node) => end.parentNode?.insertBefore(node, end),
  }, mutations, region.slots)

  if (!matched) {
    return false
  }

  for (const key of options.changedStatics ?? []) {
    if (!walkInterior(slots, region, key, mutations)) {
      return false
    }
  }

  for (const mutation of mutations) {
    if (mutation.removed && options.onRemoval) {
      const rect = rectOf(mutation.removed)

      if (rect) {
        options.onRemoval(rect)
      }
    }

    mutation.apply()

    if (!mutation.removed) {
      options.onMutation?.(mutation.target)
    }
  }

  const marker = regionOpenMarker(region.file, options.version, region.occurrence)

  if (range.start.data !== marker) {
    range.start.data = marker
  }

  region.version = options.version

  return true
}

function walkInterior(slots: Slots, region: Region, key: string, mutations: Mutation[]): boolean {
  const parsed = parseStaticsKey(key)

  if (!parsed || parsed.kind === "parts") {
    return false
  }

  const parked = slots.parked(region.file, key)

  if (!parked) {
    return false
  }

  const template = parked.cloneNode(true) as DocumentFragment

  if (parsed.kind === "item") {
    return walkItems(region, parsed.index, template, mutations)
  }

  return walkBranches(region, parsed.index, parsed.branch, template, mutations)
}

function walkItems(region: Region, index: number, template: DocumentFragment, mutations: Mutation[]): boolean {
  const content = itemTemplateContent(template, index)

  if (!content) {
    return false
  }

  for (const collection of slotsAtIndex(region, index)) {
    if (collection.type !== "collection") {
      return false
    }

    for (const liveItem of collection.items.values()) {
      const matched = walk({
        live: siblingsBetween(liveItem.start, liveItem.end),
        next: content.map((node) => node.cloneNode(true)),
        append: (node) => liveItem.end.parentNode?.insertBefore(node, liveItem.end),
      }, mutations, liveItem.slots)

      if (!matched) {
        return false
      }
    }
  }

  return true
}

function walkBranches(region: Region, index: number, arm: number, template: DocumentFragment, mutations: Mutation[]): boolean {
  for (const slot of slotsAtIndex(region, index)) {
    if (slot.type !== "conditional") {
      return false
    }

    if (slot.branch !== arm || slot.anchor.kind !== "range") {
      continue
    }

    const holder = slot.item?.slots ?? region.slots
    const end = slot.anchor.end

    const matched = walk({
      live: siblingsBetween(slot.anchor.start, end),
      next: [...template.childNodes],
      append: (node) => end.parentNode?.insertBefore(node, end),
    }, mutations, holder)

    if (!matched) {
      return false
    }
  }

  return true
}

function walk(level: Level, mutations: Mutation[], holder: Holder): boolean {
  const { live, next } = level
  let i = 0
  let j = 0

  while (i < live.length && j < next.length) {
    if (skippable(live[i])) {
      i += 1

      continue
    }

    if (skippable(next[j])) {
      j += 1

      continue
    }

    const step = pair(live[i], next[j], mutations, holder)

    if (step) {
      i += step.live
      j += step.next

      continue
    }

    if (i + 1 < live.length && shallowMatch(live[i + 1], next[j]) && inert(live[i])) {
      const removed = live[i]
      const target = removed.parentNode ?? removed

      mutations.push({ apply: () => (removed as ChildNode).remove(), target, removed })
      i += 1

      continue
    }

    if (j + 1 < next.length && shallowMatch(live[i], next[j + 1]) && inert(next[j])) {
      const anchor = live[i]
      const added = next[j]

      mutations.push({ apply: () => anchor.parentNode?.insertBefore(added, anchor), target: added })
      j += 1

      continue
    }

    if (inert(live[i]) && inert(next[j])) {
      const replaced = live[i]
      const replacement = next[j]

      mutations.push({ apply: () => (replaced as ChildNode).replaceWith(replacement), target: replacement })
      i += 1
      j += 1

      continue
    }

    return false
  }

  for (; i < live.length; i += 1) {
    if (skippable(live[i])) {
      continue
    }

    if (!inert(live[i])) {
      return false
    }

    const removed = live[i]
    const target = removed.parentNode ?? removed

    mutations.push({ apply: () => (removed as ChildNode).remove(), target, removed })
  }

  for (; j < next.length; j += 1) {
    if (skippable(next[j])) {
      continue
    }

    if (!inert(next[j])) {
      return false
    }

    const added = next[j]

    mutations.push({ apply: () => level.append(added), target: added })
  }

  return true
}

function pair(a: Node, b: Node, mutations: Mutation[], holder: Holder): { live: number; next: number } | null {
  if (a.nodeType === Node.COMMENT_NODE && b.nodeType === Node.COMMENT_NODE) {
    return pairComments(a as Comment, b as Comment, mutations, holder)
  }

  if (a.nodeType === Node.ELEMENT_NODE && b.nodeType === Node.ELEMENT_NODE) {
    return pairElements(a as Element, b as Element, mutations, holder)
  }

  if (a.nodeType === Node.TEXT_NODE && b.nodeType === Node.TEXT_NODE) {
    const value = (b as Text).data

    if ((a as Text).data !== value) {
      const target = a as Text

      mutations.push({ apply: () => { target.data = value }, target })
    }

    return { live: 1, next: 1 }
  }

  return null
}

function pairComments(a: Comment, b: Comment, mutations: Mutation[], holder: Holder): { live: number; next: number } | null {
  const liveMarker = parseMarker(a.data.trim())
  const nextMarker = parseMarker(b.data.trim())

  if (!liveMarker && !nextMarker) {
    const value = b.data

    if (a.data !== value) {
      mutations.push({ apply: () => { a.data = value }, target: a })
    }

    return { live: 1, next: 1 }
  }

  if (liveMarker?.kind !== "slot-open" || nextMarker?.kind !== "slot-open") {
    return null
  }

  if (liveMarker.index !== nextMarker.index || liveMarker.type !== nextMarker.type) {
    return null
  }

  const slot = holder.get(liveMarker.index)

  if (!slot || slot.anchor.kind !== "range" || slot.anchor.start !== a) {
    return null
  }

  const liveSpan = spanTo(a, slot.anchor.end)
  const nextSpan = closingSpan(b, nextMarker.index)

  if (liveSpan === null || nextSpan === null) {
    return null
  }

  return { live: liveSpan, next: nextSpan }
}

function pairElements(a: Element, b: Element, mutations: Mutation[], holder: Holder): { live: number; next: number } | null {
  if (a.tagName !== b.tagName) {
    return null
  }

  if ((a.getAttribute("data-herb-slot") ?? "") !== (b.getAttribute("data-herb-slot") ?? "")) {
    return null
  }

  if ((a.getAttribute("data-herb-name") ?? "") !== (b.getAttribute("data-herb-name") ?? "")) {
    return null
  }

  const entries = anchorEntries(a)
  const owned = new Set(["data-herb-slot", "data-herb-name"])

  for (const entry of entries) {
    if (entry.attribute && (entry.type === "attribute" || entry.type === "boolean_attribute" || entry.type === "attribute_interpolation")) {
      owned.add(entry.attribute)
    }
  }

  const decorated = a.getAttributeNames().some((name) => name.startsWith("data-herb-debug"))

  for (const attribute of b.getAttributeNames()) {
    if (owned.has(attribute)) {
      continue
    }

    if (attribute === "style" && decorated) {
      continue
    }

    const value = b.getAttribute(attribute) as string

    if (a.getAttribute(attribute) !== value) {
      mutations.push({ apply: () => a.setAttribute(attribute, value), target: a })
    }
  }

  for (const attribute of a.getAttributeNames()) {
    if (attribute === "style") {
      continue
    }

    if (!owned.has(attribute) && !b.hasAttribute(attribute)) {
      mutations.push({ apply: () => a.removeAttribute(attribute), target: a })
    }
  }

  const opaque = entries.some((entry) => anchorKind(entry.type) === "content")

  if (!opaque) {
    const matched = walk({
      live: [...a.childNodes],
      next: [...b.childNodes],
      append: (node) => a.appendChild(node),
    }, mutations, holder)

    if (!matched) {
      return null
    }
  }

  return { live: 1, next: 1 }
}

function slotsAtIndex(region: Region, index: number): Slot[] {
  const found: Slot[] = []
  const direct = region.slots.get(index)

  if (direct) {
    found.push(direct)
  }

  for (const candidate of region.slots.values()) {
    if (candidate.type !== "collection") {
      continue
    }

    for (const item of candidate.items.values()) {
      const slot = item.slots.get(index)

      if (slot) {
        found.push(slot)
      }
    }
  }

  return found
}

function itemTemplateContent(template: DocumentFragment, index: number): Node[] | null {
  const nodes = [...template.childNodes]
  let open = -1
  let close = -1

  for (let position = 0; position < nodes.length; position += 1) {
    const node = nodes[position]

    if (node.nodeType !== Node.COMMENT_NODE) {
      continue
    }

    const marker = parseMarker((node as Comment).data.trim())

    if (marker?.kind === "item-open" && marker.index === index && open === -1) {
      open = position
    }

    if (marker?.kind === "item-close" && marker.index === index) {
      close = position
    }
  }

  if (open === -1 || close === -1 || close <= open) {
    return null
  }

  return nodes.slice(open + 1, close)
}

function skippable(node: Node): boolean {
  if (node.nodeType !== Node.COMMENT_NODE) {
    return false
  }

  const kind = parseMarker((node as Comment).data.trim())?.kind

  return kind === "branch" || kind === "seeds"
}

function spanTo(start: Comment, end: Comment): number | null {
  let count = 1

  for (let node = start.nextSibling; node; node = node.nextSibling) {
    count += 1

    if (node === end) {
      return count
    }
  }

  return null
}

function closingSpan(open: Comment, index: number): number | null {
  let depth = 0
  let count = 1

  for (let node = open.nextSibling; node; node = node.nextSibling) {
    count += 1

    if (node.nodeType !== Node.COMMENT_NODE) {
      continue
    }

    const marker = parseMarker((node as Comment).data.trim())

    if (marker?.kind === "slot-open") {
      depth += 1
    }

    if (marker?.kind === "slot-close") {
      if (depth === 0 && marker.index === index) {
        return count
      }

      depth -= 1
    }
  }

  return null
}

function shallowMatch(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) {
    return false
  }

  if (a.nodeType === Node.ELEMENT_NODE) {
    return (a as Element).tagName === (b as Element).tagName
  }

  return true
}

function inert(node: Node): boolean {
  return markers(node).next().done === true
}

function siblingsBetween(start: Comment, end: Comment): Node[] {
  const nodes: Node[] = []

  for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
    nodes.push(node)
  }

  return nodes
}

function rectOf(node: Node): { top: number; left: number; width: number; height: number } | null {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const rect = (node as Element).getBoundingClientRect()

    return rect.width || rect.height ? rect : null
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const range = document.createRange()

    range.selectNode(node)

    const rect = range.getBoundingClientRect()

    return rect.width || rect.height ? rect : null
  }

  return null
}
