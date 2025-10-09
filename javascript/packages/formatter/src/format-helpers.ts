import { isNode } from "@herb-tools/core"
import { Node, HTMLTextNode, WhitespaceNode } from "@herb-tools/core"

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
export function filterSignificantChildren(body: Node[], hasTextFlow: boolean): Node[] {
  return body.filter(child => {
    if (isNode(child, WhitespaceNode)) return false

    if (isNode(child, HTMLTextNode)) {
      if (hasTextFlow && child.content === " ") return true

      return child.content.trim() !== ""
    }

    return true
  })
}

/**
 * Filter out empty text nodes and whitespace nodes
 */
export function filterEmptyNodes(nodes: Node[]): Node[] {
  return nodes.filter(child =>
    !isNode(child, WhitespaceNode) && !(isNode(child, HTMLTextNode) && child.content.trim() === "")
  )
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
  return /[(\[]$/.test(line)
}

/**
 * Determine if space is needed between the current line and the next word
 */
export function needsSpaceBetween(currentLine: string, word: string): boolean {
  if (isClosingPunctuation(word)) return false
  if (lineEndsWithOpeningPunctuation(currentLine)) return false

  return true
}

/**
 * Build a line by adding a word with appropriate spacing
 */
export function buildLineWithWord(currentLine: string, word: string): string {
  if (!currentLine) return word

  return needsSpaceBetween(currentLine, word) ? `${currentLine} ${word}` : `${currentLine}${word}`
}
