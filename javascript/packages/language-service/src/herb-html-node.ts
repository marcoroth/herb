import type { Node as HerbNode } from "@herb-tools/core"
import type { OffsetRange } from "./offset-utils.js"

/**
 * Source byte offset ranges for an attribute's name and value.
 * Points to the actual positions in the source text (e.g., the Ruby hash key
 * for ActionView tag helpers, not the synthesized HTML attribute name).
 */
export interface AttributeSourceRange {
  nameStart: number
  nameEnd: number
  valueStart: number
  valueEnd: number
}

/**
 * A node in the HTML document tree that matches the shape of
 * vscode-html-languageservice's Node interface.
 *
 * Wraps a Herb AST node (when available) while exposing the
 * properties that vscode-html-languageservice consumers expect.
 */
export class HerbHTMLNode {
  tag: string | undefined
  start: number
  end: number
  startTagEnd: number | undefined
  endTagStart: number | undefined
  closed: boolean
  children: HerbHTMLNode[]
  parent: HerbHTMLNode | undefined
  attributes: { [name: string]: string | null } | undefined
  attributeSourceRanges: { [name: string]: AttributeSourceRange } | undefined
  tokenListAttributes: Set<string> | undefined
  herbNode: HerbNode | undefined

  constructor(init: {
    tag?: string
    start: number
    end: number
    startTagEnd?: number
    endTagStart?: number
    closed?: boolean
    children?: HerbHTMLNode[]
    parent?: HerbHTMLNode
    attributes?: { [name: string]: string | null }
    attributeSourceRanges?: { [name: string]: AttributeSourceRange }
    tokenListAttributes?: Set<string>
    herbNode?: HerbNode
  }) {
    this.tag = init.tag
    this.start = init.start
    this.end = init.end
    this.startTagEnd = init.startTagEnd
    this.endTagStart = init.endTagStart
    this.closed = init.closed ?? false
    this.children = init.children ?? []
    this.parent = init.parent
    this.attributes = init.attributes
    this.attributeSourceRanges = init.attributeSourceRanges
    this.tokenListAttributes = init.tokenListAttributes
    this.herbNode = init.herbNode
  }

  get firstChild(): HerbHTMLNode | undefined {
    return this.children[0]
  }

  get lastChild(): HerbHTMLNode | undefined {
    return this.children[this.children.length - 1]
  }

  get attributeNames(): string[] {
    return this.attributes ? Object.keys(this.attributes) : []
  }

  getAttributeNameRange(attribute: string): OffsetRange | null {
    const range = this.attributeSourceRanges?.[attribute]
    if (!range) return null

    return { start: range.nameStart, end: range.nameEnd }
  }

  getAttributeValueRange(attribute: string): OffsetRange | null {
    const range = this.attributeSourceRanges?.[attribute]
    if (!range) return null

    return { start: range.valueStart, end: range.valueEnd }
  }

  isTokenListAttribute(attribute: string): boolean {
    return this.tokenListAttributes?.has(attribute) ?? false
  }

  getAttributeValueTokenRange(attribute: string, token: string, source: string): OffsetRange | null {
    const range = this.attributeSourceRanges?.[attribute]
    if (!range) return null

    if (!this.isTokenListAttribute(attribute)) {
      return { start: range.valueStart, end: range.valueEnd }
    }

    const valueText = source.slice(range.valueStart, range.valueEnd)
    const quoteOffset = (valueText.startsWith('"') || valueText.startsWith("'")) ? 1 : 0
    const unquoted = valueText.slice(quoteOffset, valueText.length - (quoteOffset ? 1 : 0))
    const tokenIndex = findTokenIndex(unquoted, token)

    if (tokenIndex !== -1) {
      const start = range.valueStart + quoteOffset + tokenIndex
      return { start, end: start + token.length }
    }

    return { start: range.valueStart, end: range.valueEnd }
  }

  isSameTag(tagInLowerCase: string | undefined): boolean {
    if (!this.tag || !tagInLowerCase) {
      return this.tag === tagInLowerCase
    }

    return this.tag.toLowerCase() === tagInLowerCase
  }

  /**
   * Finds the deepest node that starts before the given offset.
   * Uses the same algorithm as vscode-html-languageservice.
   */
  findNodeBefore(offset: number): HerbHTMLNode {
    const index = findLastIndex(this.children, (c) => c.start <= offset)

    if (index >= 0) {
      const child = this.children[index]

      if (offset > child.start) {
        if (offset < child.end) {
          return child.findNodeBefore(offset)
        }

        const lastChild = child.lastChild
        if (lastChild && lastChild.end > child.end) {
          return child.findNodeBefore(offset)
        }

        return child
      }
    }

    return this
  }

  findNodeAt(offset: number): HerbHTMLNode {
    const index = findFirst(this.children, (c) => offset <= c.start) - 1

    if (index >= 0) {
      const child = this.children[index]

      if (offset > child.start && offset <= child.end) {
        return child.findNodeAt(offset)
      }
    }

    return this
  }
}

function findFirst(array: HerbHTMLNode[], predicate: (node: HerbHTMLNode) => boolean): number {
  let low = 0
  let high = array.length

  while (low < high) {
    const mid = Math.floor((low + high) / 2)

    if (predicate(array[mid])) {
      high = mid
    } else {
      low = mid + 1
    }
  }

  return low
}

function findLastIndex(array: HerbHTMLNode[], predicate: (node: HerbHTMLNode) => boolean): number {
  for (let index = array.length - 1; index >= 0; index--) {
    if (predicate(array[index])) {
      return index
    }
  }

  return -1
}

export function findTokenIndex(value: string, search: string): number {
  const tokens = value.split(/\s+/)
  let offset = 0

  for (const token of tokens) {
    const tokenStart = value.indexOf(token, offset)

    if (token === search) {
      return tokenStart
    }

    offset = tokenStart + token.length
  }

  return -1
}
