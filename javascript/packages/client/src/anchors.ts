import { HERB_ATTRIBUTES } from "./attributes"
import { CONTENT_SLOT_TYPES, DEFAULT_SLOT_TYPE, isMarker, slotCloseMarker, slotOpenIndex } from "./markers"

const NAME_ENTRY = /^(\d+):(.+)$/

export const ANCHOR_ATTRIBUTE = HERB_ATTRIBUTES.slot
export const NAME_ATTRIBUTE = HERB_ATTRIBUTES.name
export const ANCHOR_SELECTOR = `[${ANCHOR_ATTRIBUTE}]`
export const NAME_SELECTOR = `[${NAME_ATTRIBUTE}]`
export const STATICS_SELECTOR = `template[${HERB_ATTRIBUTES.region}]`

import type { AnchorEntry, Bounds, Marker, NameEntry, Region, RegionRange, SlotAnchor, SlotType } from "./types"

export function anchored(element: Element): boolean {
  return element.hasAttribute(ANCHOR_ATTRIBUTE)
}

export function named(element: Element): boolean {
  return element.hasAttribute(NAME_ATTRIBUTE)
}

export function anchorEntries(element: Element): AnchorEntry[] {
  const raw = element.getAttribute(ANCHOR_ATTRIBUTE)?.split(/\s+/).filter(Boolean) ?? []

  return raw.map((entry) => {
    const [index, type, ...name] = entry.split(":")

    let attribute: string | null = null

    if (name.length > 0) {
      attribute = name.join(":")
    }

    return { index: Number(index), type: (type as SlotType) ?? DEFAULT_SLOT_TYPE, attribute }
  })
}

export function* anchoredSlots(root: ParentNode): Generator<[Element, AnchorEntry]> {
  for (const element of root.querySelectorAll(ANCHOR_SELECTOR)) {
    for (const entry of anchorEntries(element)) {
      yield [element, entry]
    }
  }
}

export function nameEntry(element: Element): NameEntry | null {
  const entry = NAME_ENTRY.exec(element.getAttribute(NAME_ATTRIBUTE) ?? "")

  if (!entry) {
    return null
  }

  return { index: Number(entry[1]), name: entry[2] }
}

export function anchorKind(type: SlotType): "content" | "element" {
  if (CONTENT_SLOT_TYPES.includes(type)) {
    return "content"
  }

  return "element"
}

export function* markers(root: Node): Generator<Marker> {
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
    acceptNode: (node) => {
      if (node.nodeType === Node.COMMENT_NODE) {
        if (isMarker((node as Comment).data.trim())) {
          return NodeFilter.FILTER_ACCEPT
        }

        return NodeFilter.FILTER_SKIP
      }

      if (anchored(node as Element) || named(node as Element)) {
        return NodeFilter.FILTER_ACCEPT
      }

      return NodeFilter.FILTER_SKIP
    },
  })

  let node = walker.nextNode()

  while (node) {
    yield node as Marker

    node = walker.nextNode()
  }
}

export function slotOpeners(fragment: DocumentFragment): Comment[] {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT, {
    acceptNode: (node) => {
      if (slotOpenIndex((node as Comment).data.trim()) === null) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const openers: Comment[] = []

  let node = walker.nextNode()

  while (node) {
    openers.push(node as Comment)

    node = walker.nextNode()
  }

  return openers
}

export function closingFor(open: Comment, index: number): Comment | null {
  const expected = slotCloseMarker(index)

  let node: Node | null = open.nextSibling

  while (node) {
    if (node.nodeType === Node.COMMENT_NODE && (node as Comment).data.trim() === expected) {
      return node as Comment
    }

    node = node.nextSibling
  }

  return null
}

export function staticsElements(root: Node): HTMLTemplateElement[] {
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

export function rangeOf(anchor: SlotAnchor): Range {
  if (anchor.kind === "range") {
    return innerRange(anchor)
  }

  const range = document.createRange()

  if (anchor.kind === "content") {
    range.selectNodeContents(anchor.element)
  } else {
    range.selectNode(anchor.element)
  }

  return range
}

export function elementOf(anchor: SlotAnchor): Element | null {
  if (anchor.kind === "range") {
    return null
  }

  return anchor.element
}

export function hostOf(anchor: SlotAnchor): Element | null {
  if (anchor.kind === "range") {
    return anchor.start.parentElement
  }

  return anchor.element
}

export function currentHTML(anchor: SlotAnchor): string {
  if (anchor.kind === "content") {
    return anchor.element.innerHTML
  }

  if (anchor.kind === "element") {
    return anchor.element.outerHTML
  }

  return htmlOf(innerRange(anchor))
}

export function currentText(anchor: SlotAnchor): string {
  if (anchor.kind === "range") {
    return innerRange(anchor).toString()
  }

  return anchor.element.textContent ?? ""
}

export function connected(anchor: SlotAnchor): boolean {
  if (anchor.kind === "range") {
    return anchor.start.isConnected
  }

  return anchor.element.isConnected
}

export function innerRange(bounds: Bounds): Range {
  const range = document.createRange()

  range.setStartAfter(bounds.start)
  range.setEndBefore(bounds.end)

  return range
}

export function outerRange(bounds: Bounds): Range {
  const range = document.createRange()

  range.setStartBefore(bounds.start)
  range.setEndAfter(bounds.end)

  return range
}

export function htmlOf(range: Range): string {
  const holder = document.createElement("div")

  holder.append(range.cloneContents())

  return holder.innerHTML
}

export function withinBounds(bounds: Bounds, node: Node): boolean {
  const after = bounds.start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
  const before = bounds.end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING

  return Boolean(after && before)
}

export function withinRegionRange(range: RegionRange, node: Node): boolean {
  const after = range.start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING

  if (!after) {
    return false
  }

  if (!range.end) {
    return true
  }

  return Boolean(range.end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)
}

export function withinRegion(region: Region, node: Node): boolean {
  return region.ranges.some((range) => withinRegionRange(range, node))
}
