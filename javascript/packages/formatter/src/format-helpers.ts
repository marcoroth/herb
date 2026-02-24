import { isNode, isERBNode, getTagName, isAnyOf, isERBControlFlowNode, hasERBOutput } from "@herb-tools/core"
import { Node, HTMLDoctypeNode, HTMLTextNode, HTMLElementNode, HTMLCommentNode, HTMLOpenTagNode, HTMLCloseTagNode, ERBIfNode, ERBContentNode, WhitespaceNode } from "@herb-tools/core"

// --- Types ---

/**
 * Analysis result for HTMLElementNode formatting decisions
 */
export interface ElementFormattingAnalysis {
  openTagInline: boolean
  elementContentInline: boolean
  closeTagInline: boolean
}

/**
 * Content unit represents a piece of content in text flow
 * Can be atomic (inline elements, ERB) or splittable (text)
 */
export interface ContentUnit {
  content: string
  type: 'text' | 'inline' | 'erb' | 'block'
  isAtomic: boolean
  breaksFlow: boolean
  isHerbDisable?: boolean
}

/**
 * Content unit paired with its source AST node
 */
export interface ContentUnitWithNode {
  unit: ContentUnit
  node: Node | null
}

// --- Constants ---

// TODO: we can probably expand this list with more tags/attributes
export const FORMATTABLE_ATTRIBUTES: Record<string, string[]> = {
  '*': ['class'],
  'img': ['srcset', 'sizes']
}

export const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'acronym', 'b', 'bdo', 'big', 'br', 'cite', 'code',
  'dfn', 'em', 'hr', 'i', 'img', 'kbd', 'label', 'map', 'object', 'q',
  'samp', 'small', 'span', 'strong', 'sub', 'sup',
  'tt', 'var', 'del', 'ins', 'mark', 's', 'u', 'time', 'wbr'
])

export const CONTENT_PRESERVING_ELEMENTS = new Set([
  'script', 'style', 'pre', 'textarea'
])

export const SPACEABLE_CONTAINERS = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'aside',
  'figure', 'details', 'summary', 'dialog', 'fieldset'
])

/**
 * Token list attributes that contain space-separated values and benefit from
 * spacing around ERB content for readability
 */
export const TOKEN_LIST_ATTRIBUTES = new Set([
  'class', 'data-controller', 'data-action'
])


// --- Node Utility Functions ---

/**
 * Check if a node is pure whitespace (empty text node with only whitespace)
 */
export function isPureWhitespaceNode(node: Node): boolean {
  return isNode(node, HTMLTextNode) && node.content.trim() === ""
}

/**
 * Check if a node is non-whitespace (has meaningful content)
 */
export function isNonWhitespaceNode(node: Node): boolean {
  if (isNode(node, WhitespaceNode)) return false
  if (isNode(node, HTMLTextNode)) return node.content.trim() !== ""

  return true
}

/**
 * Find the previous meaningful (non-whitespace) sibling
 * Returns -1 if no meaningful sibling is found
 */
export function findPreviousMeaningfulSibling(siblings: Node[], currentIndex: number): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (isNonWhitespaceNode(siblings[i])) {
      return i
    }
  }

  return -1
}

/**
 * Check if there's whitespace between two indices in children array
 */
export function hasWhitespaceBetween(children: Node[], startIndex: number, endIndex: number): boolean {
  for (let j = startIndex + 1; j < endIndex; j++) {
    if (isNode(children[j], WhitespaceNode) || isPureWhitespaceNode(children[j])) {
      return true
    }
  }

  return false
}

/**
 * Filter children to remove insignificant whitespace
 */
export function filterSignificantChildren(body: Node[]): Node[] {
  return body.filter(child => {
    if (isNode(child, WhitespaceNode)) return false

    if (isNode(child, HTMLTextNode)) {
      if (child.content === " ") return true

      return child.content.trim() !== ""
    }

    return true
  })
}

/**
 * Smart filter that preserves exactly ONE whitespace before herb:disable comments
 */
export function filterEmptyNodesForHerbDisable(nodes: Node[]): Node[] {
  const result: Node[] = []
  let pendingWhitespace: Node | null = null

  for (const node of nodes) {
    const isWhitespace = isNode(node, WhitespaceNode) || (isNode(node, HTMLTextNode) && node.content.trim() === "")
    const isHerbDisable = isNode(node, ERBContentNode) && isHerbDisableComment(node)

    if (isWhitespace) {
      if (!pendingWhitespace) {
        pendingWhitespace = node
      }
    } else {
      if (isHerbDisable && pendingWhitespace) {
        result.push(pendingWhitespace)
      }

      pendingWhitespace = null
      result.push(node)
    }
  }

  return result
}

// --- Punctuation and Word Spacing Functions ---

/**
 * Check if a word is standalone closing punctuation
 */
export function isClosingPunctuation(word: string): boolean {
  return /^[.,;:!?)\]]+$/.test(word)
}

/**
 * Check if a line ends with opening punctuation
 */
export function lineEndsWithOpeningPunctuation(line: string): boolean {
  return /[([]$/.test(line)
}

/**
 * Check if a string is an ERB tag
 */
export function isERBTag(text: string): boolean {
  return /^<%.*?%>$/.test(text.trim())
}

/**
 * Check if a string ends with an ERB tag
 */
export function endsWithERBTag(text: string): boolean {
  const trimmed = text.trim()

  return trimmed.endsWith('%>') || /%>\S+$/.test(trimmed)
}

/**
 * Check if a string starts with an ERB tag
 */
export function startsWithERBTag(text: string): boolean {
  return text.trim().startsWith('<%')
}

/**
 * Determine if space is needed between the current line and the next word
 */
export function needsSpaceBetween(currentLine: string, word: string): boolean {
  if (isClosingPunctuation(word)) return false
  if (lineEndsWithOpeningPunctuation(currentLine)) return false
  if (currentLine.endsWith(' ')) return false
  if (word.startsWith(' ')) return false
  if (endsWithERBTag(currentLine) && startsWithERBTag(word)) return false

  return true
}

/**
 * Build a line by adding a word with appropriate spacing
 */
export function buildLineWithWord(currentLine: string, word: string): string {
  if (!currentLine) return word

  if (word === ' ') {
    return currentLine.endsWith(' ') ? currentLine : `${currentLine} `
  }

  if (isClosingPunctuation(word)) {
    currentLine = currentLine.trimEnd()

    return `${currentLine}${word}`
  }

  return needsSpaceBetween(currentLine, word) ? `${currentLine} ${word}` : `${currentLine}${word}`
}

/**
 * Check if a node is an inline element or ERB node
 */
export function isInlineOrERBNode(node: Node): boolean {
  return isERBNode(node) || (isNode(node, HTMLElementNode) && isInlineElement(getTagName(node)))
}

/**
 * Check if an element should be treated as inline based on its tag name
 */
export function isInlineElement(tagName: string): boolean {
  return INLINE_ELEMENTS.has(tagName.toLowerCase())
}

/**
 * Check if the current inline element is adjacent to a previous inline element (no whitespace between)
 */
export function isAdjacentToPreviousInline(siblings: Node[], index: number): boolean {
  const previousNode = siblings[index - 1]

  if (isInlineOrERBNode(previousNode)) {
    return true
  }

  if (index > 1 && isNode(previousNode, HTMLTextNode) && !/^\s/.test(previousNode.content)) {
    const twoBack = siblings[index - 2]

    return isInlineOrERBNode(twoBack)
  }

  return false
}

/**
 * Check if a node should be appended to the last line (for adjacent inline elements and punctuation)
 */
export function shouldAppendToLastLine(child: Node, siblings: Node[], index: number): boolean {
  if (index === 0) return false

  if (isNode(child, HTMLTextNode) && !/^\s/.test(child.content)) {
    const previousNode = siblings[index - 1]

    return isInlineOrERBNode(previousNode)
  }

  if (isNode(child, HTMLElementNode) && isInlineElement(getTagName(child))) {
    return isAdjacentToPreviousInline(siblings, index)
  }

  if (isNode(child, ERBContentNode)) {
    for (let i = index - 1; i >= 0; i--) {
      const previousSibling = siblings[i]

      if (isPureWhitespaceNode(previousSibling) || isNode(previousSibling, WhitespaceNode)) {
        continue
      }

      if (previousSibling.location && child.location) {
        return previousSibling.location.end.line === child.location.start.line
      }

      break
    }
  }

  return false
}

/**
 * Check if user-intentional spacing should be preserved (double newlines between elements)
 */
export function shouldPreserveUserSpacing(child: Node, siblings: Node[], index: number): boolean {
  if (!isPureWhitespaceNode(child)) return false

  const hasPreviousNonWhitespace = index > 0 && isNonWhitespaceNode(siblings[index - 1])
  const hasNextNonWhitespace = index < siblings.length - 1 && isNonWhitespaceNode(siblings[index + 1])
  const hasMultipleNewlines = isNode(child, HTMLTextNode) && child.content.includes('\n\n')

  return hasPreviousNonWhitespace && hasNextNonWhitespace && hasMultipleNewlines
}


/**
 * Check if children contain any text content with newlines
 */
export function hasMultilineTextContent(children: Node[]): boolean {
  for (const child of children) {
    if (isNode(child, HTMLTextNode)) {
      return child.content.includes('\n')
    }

    if (isNode(child, HTMLElementNode) && hasMultilineTextContent(child.body)) {
      return true
    }
  }

  return false
}

/**
 * Check if all nested elements in the children are inline elements
 */
export function areAllNestedElementsInline(children: Node[]): boolean {
  for (const child of children) {
    if (isNode(child, HTMLElementNode)) {
      if (!isInlineElement(getTagName(child))) {
        return false
      }

      if (!areAllNestedElementsInline(child.body)) {
        return false
      }
    } else if (isAnyOf(child, HTMLDoctypeNode, HTMLCommentNode, isERBControlFlowNode)) {
      return false
    }
  }

  return true
}

/**
 * Check if element has complex ERB control flow
 */
export function hasComplexERBControlFlow(inlineNodes: Node[]): boolean {
  return inlineNodes.some(node => {
    if (isNode(node, ERBIfNode)) {
      if (node.statements.length > 0 && node.location) {
        const startLine = node.location.start.line
        const endLine = node.location.end.line

        return startLine !== endLine
      }

      return false
    }

    return false
  })
}

/**
 * Check if children contain mixed text and inline elements (like "text<em>inline</em>text")
 * or mixed ERB output and text (like "<%= value %> text")
 * This indicates content that should be formatted inline even with structural newlines
 */
export function hasMixedTextAndInlineContent(children: Node[]): boolean {
  let hasText = false
  let hasInlineElements = false

  for (const child of children) {
    if (isNode(child, HTMLTextNode)) {
      if (child.content.trim() !== "") {
        hasText = true
      }
    } else if (isNode(child, HTMLElementNode)) {
      if (isInlineElement(getTagName(child))) {
        hasInlineElements = true
      }
    }
  }

  return (hasText && hasInlineElements) || (hasERBOutput(children) && hasText)
}

export function isContentPreserving(element: HTMLElementNode | HTMLOpenTagNode | HTMLCloseTagNode): boolean {
  const tagName = getTagName(element)

  return CONTENT_PRESERVING_ELEMENTS.has(tagName)
}

/**
 * Count consecutive inline elements/ERB at the start of children (with no whitespace between)
 */
export function countAdjacentInlineElements(children: Node[]): number {
  let count = 0
  let lastSignificantIndex = -1

  for (let i = 0; i < children.length; i++) {
    const child = children[i]

    if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
      continue
    }

    const isInlineOrERB = (isNode(child, HTMLElementNode) && isInlineElement(getTagName(child))) || isNode(child, ERBContentNode)

    if (!isInlineOrERB) {
      break
    }

    if (lastSignificantIndex >= 0 && hasWhitespaceBetween(children, lastSignificantIndex, i)) {
      break
    }

    count++
    lastSignificantIndex = i
  }

  return count
}

/**
 * Check if a node represents a block-level element
 */
export function isBlockLevelNode(node: Node): boolean {
  if (!isNode(node, HTMLElementNode)) {
    return false
  }

  const tagName = getTagName(node)

  if (INLINE_ELEMENTS.has(tagName)) {
    return false
  }

  return true
}

/**
 * Check if an element is a line-breaking element (br or hr)
 */
export function isLineBreakingElement(node: Node): boolean {
  if (!isNode(node, HTMLElementNode)) {
    return false
  }

  const tagName = getTagName(node)

  return tagName === 'br' || tagName === 'hr'
}

/**
 * Normalize text by replacing multiple spaces with single space and trim
 * Then split into words
 */
export function normalizeAndSplitWords(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ')
  return normalized.trim().split(' ')
}

/**
 * Check if text ends with whitespace
 */
export function endsWithWhitespace(text: string): boolean {
  return /\s$/.test(text)
}

/**
 * Check if an ERB content node is a herb:disable comment
 */
export function isHerbDisableComment(node: Node): boolean {
  if (!isNode(node, ERBContentNode)) return false
  if (node.tag_opening?.value !== "<%#") return false

  const content = node?.content?.value || ""
  const trimmed = content.trim()

  return trimmed.startsWith("herb:disable")
}

/**
 * Check if a text node is YAML frontmatter (starts and ends with ---)
 */
export function isFrontmatter(node: Node): node is HTMLTextNode {
  if (!isNode(node, HTMLTextNode)) return false

  const content = node.content.trim()

  return content.startsWith("---") && /---\s*$/.test(content)
}
