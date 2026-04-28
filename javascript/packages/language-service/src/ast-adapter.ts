import type {
  Node as HerbNode,
  DocumentNode,
  HTMLElementNode,
  HTMLConditionalElementNode,
  HTMLAttributeValueNode,
  HTMLDoctypeNode,
} from "@herb-tools/core"

import {
  isHTMLElementNode,
  isHTMLConditionalElementNode,
  isHTMLDoctypeNode,
  isHTMLAttributeNode,
  isHTMLOpenTagNode,
  isERBOpenTagNode,
  isLiteralNode,
  isERBContentNode,
} from "@herb-tools/core"

import { getStaticAttributeName } from "@herb-tools/core"

import { HerbHTMLNode, type AttributeSourceRange } from "./herb-html-node.js"
import { type LineOffsetTable, locationToOffsets, positionToOffset } from "./offset-utils.js"

export function adaptDocumentChildren(document: DocumentNode, lineOffsets: LineOffsetTable, source: string, tokenListAttributes?: Set<string>): HerbHTMLNode[] {
  const roots = adaptChildren(document.children, undefined, lineOffsets, source)

  if (tokenListAttributes) {
    propagateTokenListAttributes(roots, tokenListAttributes)
  }

  return roots
}

function propagateTokenListAttributes(nodes: HerbHTMLNode[], tokenListAttributes: Set<string>): void {
  for (const node of nodes) {
    node.tokenListAttributes = tokenListAttributes
    propagateTokenListAttributes(node.children, tokenListAttributes)
  }
}

function adaptChildren(herbChildren: HerbNode[], parent: HerbHTMLNode | undefined, lineOffsets: LineOffsetTable, source: string): HerbHTMLNode[] {
  const result: HerbHTMLNode[] = []

  for (const child of herbChildren) {
    if (isHTMLElementNode(child)) {
      result.push(adaptHTMLElement(child, parent, lineOffsets, source))
    } else if (isHTMLConditionalElementNode(child)) {
      result.push(adaptConditionalElement(child, parent, lineOffsets, source))
    } else if (isHTMLDoctypeNode(child)) {
      result.push(adaptDoctype(child, parent, lineOffsets))
    } else {
      result.push(...adaptChildren(child.compactChildNodes(), parent, lineOffsets, source))
    }
  }

  return result
}

function adaptHTMLElement(node: HTMLElementNode, parent: HerbHTMLNode | undefined, lineOffsets: LineOffsetTable, source: string): HerbHTMLNode {
  const offsets = locationToOffsets(node.location, lineOffsets)
  const startTagEnd = computeStartTagEnd(node.open_tag, lineOffsets)
  const endTagStart = node.close_tag
    ? positionToOffset(node.close_tag.location.start.line, node.close_tag.location.start.column, lineOffsets)
    : undefined
  const extracted = extractAttributes(node.open_tag, source, lineOffsets)

  const adapted = new HerbHTMLNode({
    tag: node.tag_name?.value ?? undefined,
    start: offsets.start,
    end: offsets.end,
    startTagEnd,
    endTagStart,
    closed: node.is_void || node.close_tag !== null,
    attributes: extracted?.attributes,
    attributeSourceRanges: extracted?.sourceRanges,
    parent,
    herbNode: node,
  })

  adapted.children = adaptChildren(node.body, adapted, lineOffsets, source)

  return adapted
}

function adaptConditionalElement(node: HTMLConditionalElementNode, parent: HerbHTMLNode | undefined, lineOffsets: LineOffsetTable, source: string): HerbHTMLNode {
  const offsets = locationToOffsets(node.location, lineOffsets)

  const startTagEnd = node.open_tag
    ? positionToOffset(node.open_tag.location.end.line, node.open_tag.location.end.column, lineOffsets)
    : undefined

  const endTagStart = node.close_tag
    ? positionToOffset(node.close_tag.location.start.line, node.close_tag.location.start.column, lineOffsets)
    : undefined

  const extracted = node.open_tag && isHTMLOpenTagNode(node.open_tag)
    ? extractAttributes(node.open_tag, source, lineOffsets)
    : undefined

  const adapted = new HerbHTMLNode({
    tag: node.tag_name?.value ?? undefined,
    start: offsets.start,
    end: offsets.end,
    startTagEnd,
    endTagStart,
    closed: node.close_tag !== null,
    attributes: extracted?.attributes,
    attributeSourceRanges: extracted?.sourceRanges,
    parent,
    herbNode: node,
  })

  adapted.children = adaptChildren(node.body, adapted, lineOffsets, source)

  return adapted
}

function adaptDoctype(node: HTMLDoctypeNode, parent: HerbHTMLNode | undefined, lineOffsets: LineOffsetTable): HerbHTMLNode {
  const offsets = locationToOffsets(node.location, lineOffsets)

  return new HerbHTMLNode({
    tag: "!DOCTYPE",
    start: offsets.start,
    end: offsets.end,
    closed: true,
    parent,
    herbNode: node,
  })
}

interface ExtractedAttributes {
  attributes: { [name: string]: string | null }
  sourceRanges: { [name: string]: AttributeSourceRange }
}

function extractAttributes(openTag: HTMLElementNode["open_tag"], source: string, lineOffsets: LineOffsetTable): ExtractedAttributes | undefined {
  if (!openTag) return undefined

  let children: HerbNode[] | undefined

  if (isHTMLOpenTagNode(openTag)) {
    children = openTag.children
  } else if (isERBOpenTagNode(openTag)) {
    children = openTag.children
  } else {
    return undefined
  }

  if (!children || children.length === 0) return undefined

  const attributes: { [name: string]: string | null } = {}
  const sourceRanges: { [name: string]: AttributeSourceRange } = {}

  for (const child of children) {
    if (!isHTMLAttributeNode(child)) continue

    const name = child.name ? getStaticAttributeName(child.name) : null
    if (!name) continue

    attributes[name] = child.value ? extractAttributeValue(child.value) : null
    sourceRanges[name] = computeAttributeSourceRange(child, name, attributes[name], source, lineOffsets)
  }

  if (Object.keys(attributes).length === 0) return undefined

  return { attributes, sourceRanges }
}

function extractAttributeValue(valueNode: HTMLAttributeValueNode): string {
  const quote = valueNode.open_quote?.value ?? ""

  const content = valueNode.children.map((child) => {
    if (isLiteralNode(child)) return child.content

    if (isERBContentNode(child)) {
      const opening = child.tag_opening?.value ?? ""
      const content = child.content?.value ?? ""
      const closing = child.tag_closing?.value ?? ""

      return `${opening}${content}${closing}`
    }

    return ""
  }).join("")

  const closeQuote = valueNode.close_quote?.value ?? ""

  return `${quote}${content}${closeQuote}`
}

function computeAttributeSourceRange(attributeNode: HerbNode, name: string, quotedValue: string | null, source: string, lineOffsets: LineOffsetTable): AttributeSourceRange {
  const attributeOffsets = locationToOffsets(attributeNode.location, lineOffsets)
  const regionOffset = Math.max(0, attributeOffsets.start - 20)

  const searchRegion = source.slice(
    regionOffset,
    attributeOffsets.end + (quotedValue ? quotedValue.length : 0) + 10,
  )

  let nameIndex = searchRegion.indexOf(name)

  if (nameIndex === -1) {
    for (const prefix of ["data-", "aria-"]) {
      if (nameIndex !== -1) break

      if (name.startsWith(prefix)) {
        const withoutPrefix = name.slice(prefix.length).replace(/-/g, "_")
        nameIndex = searchRegion.indexOf(withoutPrefix)
      }
    }
  }

  if (nameIndex === -1) {
    const underscored = name.replace(/-/g, "_")

    nameIndex = searchRegion.indexOf(underscored)
  }

  if (nameIndex === -1) {
    const lastSegment = name.includes("-") ? name.slice(name.lastIndexOf("-") + 1) : name

    nameIndex = searchRegion.indexOf(lastSegment)
  }

  let nameStart: number
  let nameEnd: number

  if (nameIndex !== -1) {
    nameStart = regionOffset + nameIndex
    const matchLength = searchRegion.slice(nameIndex).match(/^[a-zA-Z0-9_-]+/)?.[0]?.length ?? name.length
    nameEnd = regionOffset + nameIndex + matchLength
  } else {
    nameStart = attributeOffsets.start
    nameEnd = attributeOffsets.end
  }

  let valueStart = nameEnd
  let valueEnd = nameEnd

  if (quotedValue) {
    const afterName = source.slice(nameEnd, nameEnd + quotedValue.length + 20)
    const valueIndex = afterName.indexOf(quotedValue)

    if (valueIndex !== -1) {
      valueStart = nameEnd + valueIndex
      valueEnd = valueStart + quotedValue.length
    } else {
      const wideSearch = source.slice(attributeOffsets.start, attributeOffsets.end + quotedValue.length + 10)
      const wideIndex = wideSearch.indexOf(quotedValue)

      if (wideIndex !== -1) {
        valueStart = attributeOffsets.start + wideIndex
        valueEnd = valueStart + quotedValue.length
      }
    }
  }

  return { nameStart, nameEnd, valueStart, valueEnd }
}

function computeStartTagEnd(openTag: HTMLElementNode["open_tag"], lineOffsets: LineOffsetTable): number | undefined {
  if (!openTag) return undefined

  return positionToOffset(
    openTag.location.end.line,
    openTag.location.end.column,
    lineOffsets,
  )
}
