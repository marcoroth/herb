import { isNode, getTagName, isERBOutputNode } from "@herb-tools/core"
import { Node, HTMLTextNode, HTMLElementNode, ERBContentNode, WhitespaceNode } from "@herb-tools/core"

import type { ContentUnitWithNode } from "./format-helpers.js"

import {
  endsWithWhitespace,
  hasWhitespaceBetween,
  isInlineElement,
  normalizeAndSplitWords,
} from "./format-helpers.js"


/**
 * Check if a node participates in text flow
 */
export function isTextFlowNode(node: Node): boolean {
  if (isNode(node, ERBContentNode)) return true
  if (isNode(node, HTMLTextNode) && node.content.trim() !== "") return true
  if (isNode(node, HTMLElementNode) && isInlineElement(getTagName(node))) return true

  return false
}

/**
 * Check if a node is whitespace that can appear within a text flow run
 */
export function isTextFlowWhitespace(node: Node): boolean {
  if (isNode(node, WhitespaceNode)) return true
  if (isNode(node, HTMLTextNode) && node.content.trim() === "" && !node.content.includes('\n\n')) return true

  return false
}

/**
 * Collect a run of text flow nodes starting at the given index.
 * Returns the nodes in the run and the index after the last node.
 * Returns null if the run doesn't qualify (needs 2+ text flow nodes with both text and atomic content).
 */
export function collectTextFlowRun(body: Node[], startIndex: number): { nodes: Node[], endIndex: number } | null {
  const nodes: Node[] = []
  let index = startIndex
  let textFlowCount = 0

  while (index < body.length) {
    const child = body[index]

    if (isTextFlowNode(child)) {
      nodes.push(child)
      textFlowCount++
      index++
    } else if (isTextFlowWhitespace(child)) {
      let hasMoreTextFlow = false

      for (let lookaheadIndex = index + 1; lookaheadIndex < body.length; lookaheadIndex++) {
        if (isTextFlowNode(body[lookaheadIndex])) {
          hasMoreTextFlow = true
          break
        }

        if (isTextFlowWhitespace(body[lookaheadIndex])) {
          continue
        }

        break
      }

      if (hasMoreTextFlow) {
        nodes.push(child)
        index++
      } else {
        break
      }
    } else {
      break
    }
  }

  if (textFlowCount >= 2) {
    const hasText = nodes.some(node => isNode(node, HTMLTextNode) && node.content.trim() !== "")
    const hasAtomicContent = nodes.some(node => isNode(node, ERBContentNode) || (isNode(node, HTMLElementNode) && isInlineElement(getTagName(node))))

    if (hasText && hasAtomicContent) {
      return { nodes, endIndex: index }
    }
  }

  return null
}

/**
 * Check if children represent a text flow context
 * (has text content mixed with inline elements or ERB)
 */
export function isInTextFlowContext(children: Node[]): boolean {
  const hasTextContent = children.some(child => isNode(child, HTMLTextNode) && child.content.trim() !== "")
  const nonTextChildren = children.filter(child => !isNode(child, HTMLTextNode))

  if (!hasTextContent) return false
  if (nonTextChildren.length === 0) return false

  const allInline = nonTextChildren.every(child => {
    if (isNode(child, ERBContentNode)) return true

    if (isNode(child, HTMLElementNode)) {
      return isInlineElement(getTagName(child))
    }

    return false
  })

  if (!allInline) return false

  return true
}

/**
 * Check whether a node renders visible output that participates in text flow:
 * non-empty text, an ERB *output* tag (`<%= %>` / `<%== %>`), or an inline
 * element. Control-flow / non-output ERB (`<% ... %>`) renders nothing, so it
 * never contributes rendered whitespace.
 */
function rendersVisibleOutput(node: Node): boolean {
  if (isNode(node, HTMLTextNode)) return node.content.trim() !== ""
  if (isERBOutputNode(node)) return true
  if (isNode(node, HTMLElementNode)) return isInlineElement(getTagName(node))

  return false
}

/**
 * Check whether a list of statements/children contains a "glued" text-flow
 * boundary: two adjacent nodes that both render visible output and touch
 * without any whitespace between them, e.g. `<%= user.name %>'s dog`,
 * `<%= greeting %>,` or `John<%= suffix %>`.
 *
 * Breaking such a boundary onto separate lines would inject whitespace into the
 * rendered HTML that wasn't in the source (#1729). When nodes are separated by
 * whitespace, or one side renders nothing (a `<% ... %>` control statement such
 * as `<% i += 1 %>`), breaking across lines is rendering-safe, so this returns
 * false and callers can keep their per-node visiting.
 */
export function hasGluedTextFlowBoundary(children: Node[]): boolean {
  let previousNode: Node | null = null
  let previousIndex = -1

  for (let index = 0; index < children.length; index++) {
    const child = children[index]

    // Whitespace, and any node that renders nothing, breaks the glue chain:
    // there is no rendered content on this side to be split apart.
    if (!rendersVisibleOutput(child)) {
      previousNode = null
      previousIndex = -1

      continue
    }

    if (previousNode) {
      const separated =
        hasWhitespaceBetween(children, previousIndex, index) ||
        (isNode(previousNode, HTMLTextNode) && endsWithWhitespace(previousNode.content)) ||
        (isNode(child, HTMLTextNode) && /^[ \t\n\r]/.test(child.content))

      if (!separated) return true
    }

    previousNode = child
    previousIndex = index
  }

  return false
}

/**
 * Try to merge text that follows an atomic unit (ERB/inline) with no whitespace.
 * Merges the first word of the text into the preceding atomic unit.
 * Returns true if merge was performed.
 */
export function tryMergeTextAfterAtomic(result: ContentUnitWithNode[], textNode: HTMLTextNode): boolean {
  if (result.length === 0) return false

  const lastUnit = result[result.length - 1]

  if (!lastUnit.unit.isAtomic || (lastUnit.unit.type !== 'erb' && lastUnit.unit.type !== 'inline')) {
    return false
  }

  const words = normalizeAndSplitWords(textNode.content)
  if (words.length === 0 || !words[0]) return false

  const firstWord = words[0]
  const firstChar = firstWord[0]

  if (' \t\n\r'.includes(firstChar)) {
    return false
  }

  lastUnit.unit.content += firstWord

  if (words.length > 1) {
    let remainingText = words.slice(1).join(' ')

    if (endsWithWhitespace(textNode.content)) {
      remainingText += ' '
    }

    result.push({
      unit: { content: remainingText, type: 'text', isAtomic: false, breaksFlow: false },
      node: textNode
    })
  } else if (endsWithWhitespace(textNode.content)) {
    result.push({
      unit: { content: ' ', type: 'text', isAtomic: false, breaksFlow: false },
      node: textNode
    })
  }

  return true
}

/**
 * Try to merge an atomic unit (ERB/inline) with preceding text that has no whitespace.
 * Splits preceding text, merges last word with atomic content.
 * Returns true if merge was performed.
 */
export function tryMergeAtomicAfterText(result: ContentUnitWithNode[], children: Node[], lastProcessedIndex: number, atomicContent: string, atomicType: 'erb' | 'inline', atomicNode: Node): boolean {
  if (result.length === 0) return false

  const lastUnit = result[result.length - 1]
  if (lastUnit.unit.type !== 'text' || lastUnit.unit.isAtomic) return false

  const words = normalizeAndSplitWords(lastUnit.unit.content)
  const lastWord = words[words.length - 1]
  if (!lastWord) return false

  result.pop()

  if (words.length > 1) {
    const remainingText = words.slice(0, -1).join(' ')

    result.push({
      unit: { content: remainingText, type: 'text', isAtomic: false, breaksFlow: false },
      node: children[lastProcessedIndex]
    })
  }

  result.push({
    unit: { content: lastWord + atomicContent, type: atomicType, isAtomic: true, breaksFlow: false },
    node: atomicNode
  })

  return true
}

/**
 * Check if there's whitespace between current node and last processed node
 */
export function hasWhitespaceBeforeNode(children: Node[], lastProcessedIndex: number, currentIndex: number, currentNode: Node): boolean {
  if (hasWhitespaceBetween(children, lastProcessedIndex, currentIndex)) {
    return true
  }

  if (isNode(currentNode, HTMLTextNode) && /^[ \t\n\r]/.test(currentNode.content)) {
    return true
  }

  return false
}

/**
 * Check if last unit in result ends with whitespace
 */
export function lastUnitEndsWithWhitespace(result: ContentUnitWithNode[]): boolean {
  if (result.length === 0) return false

  const lastUnit = result[result.length - 1]

  return lastUnit.unit.type === 'text' && endsWithWhitespace(lastUnit.unit.content)
}

/**
 * Wrap remaining words that don't fit on the current line.
 * Returns the wrapped lines with proper indentation.
 */
export function wrapRemainingWords(words: string[], wrapWidth: number, indent: string): string[] {
  const lines: string[] = []
  let line = ""

  for (const word of words) {
    const testLine = line + (line ? " " : "") + word

    if (testLine.length > wrapWidth && line) {
      lines.push(indent + line)
      line = word
    } else {
      line = testLine
    }
  }

  if (line) {
    lines.push(indent + line)
  }

  return lines
}

/**
 * Try to merge text starting with punctuation to inline content.
 * Returns object with merged content and whether processing should stop.
 */
export function tryMergePunctuationText(inlineContent: string, trimmedText: string, wrapWidth: number, indent: string): { mergedContent: string, shouldStop: boolean, wrappedLines: string[] } {
  const combined = inlineContent + trimmedText

  if (combined.length <= wrapWidth) {
    return {
      mergedContent: inlineContent + trimmedText,
      shouldStop: false,
      wrappedLines: []
    }
  }

  const match = trimmedText.match(/^[.!?:;%]+/)

  if (!match) {
    return {
      mergedContent: inlineContent,
      shouldStop: false,
      wrappedLines: []
    }
  }

  const punctuation = match[0]
  const restText = trimmedText.substring(punctuation.length).trim()

  if (!restText) {
    return {
      mergedContent: inlineContent + punctuation,
      shouldStop: false,
      wrappedLines: []
    }
  }

  const words = restText.split(/[ \t\n\r]+/)
  let toMerge = punctuation
  let mergedWordCount = 0

  for (const word of words) {
    const testMerge = toMerge + ' ' + word

    if ((inlineContent + testMerge).length <= wrapWidth) {
      toMerge = testMerge
      mergedWordCount++
    } else {
      break
    }
  }

  const mergedContent = inlineContent + toMerge

  if (mergedWordCount >= words.length) {
    return {
      mergedContent,
      shouldStop: false,
      wrappedLines: []
    }
  }

  const remainingWords = words.slice(mergedWordCount)
  const wrappedLines = wrapRemainingWords(remainingWords, wrapWidth, indent)

  return {
    mergedContent,
    shouldStop: true,
    wrappedLines
  }
}
