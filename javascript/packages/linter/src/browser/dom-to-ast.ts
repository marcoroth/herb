import { isVoidElement, SourcePath } from "@herb-tools/core"
import { parseMarker } from "@herb-tools/client/directives"

import { Range, DocumentNode, HTMLAttributeNameNode, HTMLAttributeNode, HTMLAttributeValueNode, HTMLCloseTagNode, HTMLCommentNode, HTMLElementNode, HTMLOpenTagNode, HTMLTextNode, LiteralNode, Location, Token } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"

export interface DOMNodeLike {
  nodeType: number
}

export interface DOMTextLike extends DOMNodeLike {
  data: string
}

export interface DOMAttributeLike {
  name: string
  value: string
}

export interface DOMElementLike extends DOMNodeLike {
  tagName: string
  localName: string
  attributes: ArrayLike<DOMAttributeLike>
  childNodes: ArrayLike<DOMNodeLike>
}

export interface DOMParentLike extends DOMNodeLike {
  childNodes: ArrayLike<DOMNodeLike>
}

export interface WithDOMNode {
  [DOM_NODE]?: DOMNodeLike
}

export interface WithSourcePath {
  [SOURCE_PATH]?: SourcePath
}

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const COMMENT_NODE = 8
const DOCUMENT_NODE = 9
const DOCUMENT_FRAGMENT_NODE = 11
const NO_LOCATION = Location.fromOptional(null)

export const SOURCE_ATTRIBUTE = "data-herb-source"
export const DOM_NODE = Symbol.for("herb.domNode")
export const SOURCE_PATH = Symbol.for("herb.sourcePath")

function regionOpenedBy(data: string): SourcePath | null {
  const marker = parseMarker(data.trim())

  if (marker?.kind !== "region-open") return null

  return marker.file === "" ? null : new SourcePath(marker.file, { line: 1, column: 0 })
}

function regionClosedBy(data: string): boolean {
  return parseMarker(data.trim())?.kind === "region-close"
}

function locationFrom(source: SourcePath | null): Location {
  const position = source?.position ?? null

  return position ? new Location(position, position) : NO_LOCATION
}

function attributeOn(element: DOMElementLike, name: string): string | null {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === name) return attribute.value
  }

  return null
}

function sourceOn(element: DOMElementLike): SourcePath | null {
  const stamp = attributeOn(element, SOURCE_ATTRIBUTE)

  return stamp === null ? null : SourcePath.parse(stamp)
}

export function sourcePathForElement(element: DOMNodeLike | null | undefined, projectPath: string | null = null): SourcePath | null {
  let current: DOMNodeLike | null | undefined = element

  while (current) {
    if (current.nodeType === ELEMENT_NODE) {
      const stamp = attributeOn(current as DOMElementLike, SOURCE_ATTRIBUTE)

      if (stamp !== null) return SourcePath.parse(stamp, projectPath)
    }

    current = (current as { parentNode?: DOMNodeLike | null }).parentNode ?? null
  }

  return null
}

export function sourcePathOf(node: object): SourcePath | null {
  return (node as WithSourcePath)[SOURCE_PATH] ?? null
}

export function sourcePathsIn(root: Node): Map<Location, SourcePath> {
  return collect(root, sourcePathOf)
}

export function domNodesIn(root: Node): Map<Location, DOMNodeLike> {
  return collect(root, (node) => (node as WithDOMNode)[DOM_NODE] ?? null)
}

function collect<T>(root: Node, of: (node: Node) => T | null): Map<Location, T> {
  const found = new Map<Location, T>()

  const walk = (node: Node | null | undefined) => {
    if (!node) return

    const value = of(node)

    if (value !== null && node.location) {
      found.set(node.location, value)
    }

    for (const child of node.childNodes()) {
      walk(child)
    }
  }

  walk(root)

  return found
}

function token(type: string, value: string, location: Location = NO_LOCATION): Token {
  return new Token(value, Range.fromOptional(null), location, type)
}

function literal(content: string, location: Location = NO_LOCATION): LiteralNode {
  return LiteralNode.build({ content, location })
}

function attribute(name: string, value: string, location: Location): HTMLAttributeNode {
  return HTMLAttributeNode.build({
    location,
    name: HTMLAttributeNameNode.build({ children: [literal(name, location)], location }),
    equals: token("TOKEN_EQUALS", "=", location),
    value: HTMLAttributeValueNode.build({
      open_quote: token("TOKEN_QUOTE", '"', location),
      children: [literal(value, location)],
      close_quote: token("TOKEN_QUOTE", '"', location),
      quoted: true,
      location,
    }),
  })
}

function attributes(element: DOMElementLike, location: Location): HTMLAttributeNode[] {
  return Array.from(element.attributes).map((attr) => attribute(attr.name, attr.value, location))
}

function tag(element: DOMElementLike): string {
  return element.tagName.toLowerCase()
}

function elementNode(element: DOMElementLike, inherited: SourcePath | null, region: SourcePath | null): HTMLElementNode {
  const name = tag(element)
  const isVoid = isVoidElement(name)
  const source = sourceOn(element) ?? inherited ?? region
  const location = locationFrom(source)
  const tagName = token("TOKEN_HTML_TAG_NAME", name, location)

  const openTag = HTMLOpenTagNode.build({
    tag_opening: token("TOKEN_HTML_TAG_START", "<", location),
    tag_name: tagName,
    tag_closing: token("TOKEN_HTML_TAG_END", ">", location),
    children: attributes(element, location),
    is_void: isVoid,
    location,
  })

  const closeTag = isVoid ? null : HTMLCloseTagNode.build({
    tag_opening: token("TOKEN_HTML_TAG_START_CLOSE", "</", location),
    tag_name: tagName,
    tag_closing: token("TOKEN_HTML_TAG_END", ">", location),
    location,
  })

  const node = HTMLElementNode.build({
    open_tag: openTag,
    tag_name: tagName,
    body: isVoid ? [] : children(element, source, region),
    close_tag: closeTag,
    is_void: isVoid,
    element_source: "DOM",
    location,
  })

  ;(node as HTMLElementNode & WithDOMNode)[DOM_NODE] = element
  ;(openTag as HTMLOpenTagNode & WithDOMNode)[DOM_NODE] = element

  if (source) {
    ;(node as HTMLElementNode & WithSourcePath)[SOURCE_PATH] = source
    ;(openTag as HTMLOpenTagNode & WithSourcePath)[SOURCE_PATH] = source

  }

  return node
}

function commentNode(comment: DOMTextLike, source: SourcePath | null): HTMLCommentNode {
  const location = locationFrom(source)

  return HTMLCommentNode.build({
    comment_start: token("TOKEN_HTML_COMMENT_START", "<!--", location),
    children: [literal(comment.data, location)],
    comment_end: token("TOKEN_HTML_COMMENT_END", "-->", location),
    location,
  })
}

function textNode(text: DOMTextLike, source: SourcePath | null): HTMLTextNode {
  return HTMLTextNode.build({ content: text.data, location: locationFrom(source) })
}

function convert(node: DOMNodeLike, inherited: SourcePath | null, region: SourcePath | null): Node | null {
  switch (node.nodeType) {
    case ELEMENT_NODE: {
      return elementNode(node as DOMElementLike, inherited, region)
    }

    case TEXT_NODE: {
      return textNode(node as DOMTextLike, inherited ?? region)
    }

    case COMMENT_NODE: {
      return commentNode(node as DOMTextLike, inherited ?? region)
    }

    default: return null
  }
}

function children(node: DOMParentLike, inherited: SourcePath | null, region: SourcePath | null): Node[] {
  const nodes: Node[] = []
  const enclosing: (SourcePath | null)[] = []

  let current = region

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === COMMENT_NODE) {
      const data = (child as DOMTextLike).data
      const opened = regionOpenedBy(data)

      if (opened) {
        enclosing.push(current)
        current = opened
      } else if (regionClosedBy(data)) {
        current = enclosing.pop() ?? region
      }
    }

    const converted = convert(child, inherited, current)

    if (converted !== null) {
      nodes.push(converted)
    }
  }

  return nodes
}

export function domToAST(root: DOMNodeLike): DocumentNode {
  const holdsChildren = root.nodeType === DOCUMENT_NODE || root.nodeType === DOCUMENT_FRAGMENT_NODE

  const roots = holdsChildren
    ? children(root as DOMParentLike, null, null)
    : [convert(root, null, null)].filter((child): child is Node => child !== null)

  return DocumentNode.build({ children: roots, location: NO_LOCATION })
}
