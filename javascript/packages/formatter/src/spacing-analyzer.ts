import { Node, HTMLTextNode, HTMLElementNode, HTMLDoctypeNode, ERBContentNode, WhitespaceNode, XMLDeclarationNode } from "@herb-tools/core"
import { isNode, getTagName, isERBNode, isERBOutputNode, isERBCommentNode, isCommentNode, isERBControlFlowNode } from "@herb-tools/core"
import { findPreviousMeaningfulSibling, isBlockLevelNode, isContentPreserving, isNonWhitespaceNode } from "./format-helpers.js"

import { INLINE_ELEMENTS, SPACEABLE_CONTAINERS } from "./format-helpers.js"

/**
 * SpacingAnalyzer determines when blank lines should be inserted between
 * sibling elements. It implements the "rule of three" intelligent spacing
 * system: adds spacing between 3+ meaningful siblings, respects semantic
 * groupings, groups comments with following elements, and preserves
 * user-added spacing.
 */
export class SpacingAnalyzer {
  private nodeIsMultiline: Map<Node, boolean>
  private tagGroupsCache = new Map<Node[], Map<number, { tagName: string; groupStart: number; groupEnd: number }>>()
  private allSingleLineCache = new Map<Node[], boolean>()

  constructor(nodeIsMultiline: Map<Node, boolean>) {
    this.nodeIsMultiline = nodeIsMultiline
  }

  clear(): void {
    this.tagGroupsCache.clear()
    this.allSingleLineCache.clear()
  }

  /**
   * Determine if spacing should be added between sibling elements
   *
   * This implements the "rule of three" intelligent spacing system:
   * - Adds spacing between 3 or more meaningful siblings
   * - Respects semantic groupings (e.g., ul/li, nav/a stay tight)
   * - Groups comments with following elements
   * - Preserves user-added spacing
   *
   * @param parentElement - The parent element containing the siblings
   * @param siblings - Array of all sibling nodes
   * @param currentIndex - Index of the current node being evaluated
   * @returns true if spacing should be added before the current element
   */
  shouldAddSpacingBetweenSiblings(parentElement: HTMLElementNode | null, siblings: Node[], currentIndex: number): boolean {
    const currentNode = siblings[currentIndex]
    const previousMeaningfulIndex = findPreviousMeaningfulSibling(siblings, currentIndex)
    const previousNode = previousMeaningfulIndex !== -1 ? siblings[previousMeaningfulIndex] : null

    if (previousNode && (isNode(previousNode, XMLDeclarationNode) || isNode(previousNode, HTMLDoctypeNode))) {
      return true
    }

    const hasMixedContent = siblings.some(child => isNode(child, HTMLTextNode) && child.content.trim() !== "")

    if (hasMixedContent) return false

    const isCurrentComment = isCommentNode(currentNode)
    const isPreviousComment = previousNode ? isCommentNode(previousNode) : false
    const isCurrentMultiline = this.isMultilineElement(currentNode)
    const isPreviousMultiline = previousNode ? this.isMultilineElement(previousNode) : false

    if (isPreviousComment && !isCurrentComment && (isNode(currentNode, HTMLElementNode) || isERBNode(currentNode))) {
      return isPreviousMultiline && isCurrentMultiline
    }

    if (isPreviousComment && isCurrentComment) {
      return false
    }

    if (isCurrentMultiline || isPreviousMultiline) {
      return true
    }

    const meaningfulSiblings = siblings.filter(child => isNonWhitespaceNode(child))
    const parentTagName = parentElement ? getTagName(parentElement) : null
    const isSpaceableContainer = !parentTagName || SPACEABLE_CONTAINERS.has(parentTagName)
    const tagGroups = this.detectTagGroups(siblings)

    const cached = this.allSingleLineCache.get(siblings)
    let allSingleLineHTMLElements: boolean
    if (cached !== undefined) {
      allSingleLineHTMLElements = cached
    } else {
      allSingleLineHTMLElements = meaningfulSiblings.every(node => isNode(node, HTMLElementNode) && !this.isMultilineElement(node))
      this.allSingleLineCache.set(siblings, allSingleLineHTMLElements)
    }

    if (!isSpaceableContainer && meaningfulSiblings.length < 5) {
      return false
    }

    const currentGroup = tagGroups.get(currentIndex)
    const previousGroup = previousNode ? tagGroups.get(previousMeaningfulIndex) : undefined

    if (currentGroup && previousGroup && currentGroup.groupStart === previousGroup.groupStart && currentGroup.groupEnd === previousGroup.groupEnd) {
      return false
    }

    if (previousGroup && previousGroup.groupEnd === previousMeaningfulIndex) {
      return true
    }

    if (allSingleLineHTMLElements && tagGroups.size === 0) {
      return false
    }

    if (isNode(currentNode, HTMLElementNode)) {
      const currentTagName = getTagName(currentNode)

      if (currentTagName && INLINE_ELEMENTS.has(currentTagName)) {
        return false
      }
    }

    const isBlockElement = isBlockLevelNode(currentNode)
    const isERBBlock = isERBNode(currentNode) && isERBControlFlowNode(currentNode)
    const isComment = isCommentNode(currentNode)

    return isBlockElement || isERBBlock || isComment
  }

  /**
   * Check if there's a blank line (double newline) in the nodes at the given index
   */
  hasBlankLineBetween(body: Node[], index: number): boolean {
    for (let lookbackIndex = index - 1; lookbackIndex >= 0 && lookbackIndex >= index - 2; lookbackIndex--) {
      const node = body[lookbackIndex]

      if (isNode(node, HTMLTextNode) && node.content.includes('\n\n')) {
        return true
      }

      if (isNode(node, WhitespaceNode)) {
        continue
      }

      break
    }

    for (let lookaheadIndex = index; lookaheadIndex < body.length && lookaheadIndex <= index + 1; lookaheadIndex++) {
      const node = body[lookaheadIndex]

      if (isNode(node, HTMLTextNode) && node.content.includes('\n\n')) {
        return true
      }

      if (isNode(node, WhitespaceNode)) {
        continue
      }

      break
    }

    return false
  }

  /**
   * Check if a node will render as multiple lines when formatted.
   */
  private isMultilineElement(node: Node): boolean {
    if (isNode(node, ERBContentNode)) {
      return (node.content?.value || "").includes("\n")
    }

    if (isNode(node, HTMLElementNode) && isContentPreserving(node)) {
      return true
    }

    const tracked = this.nodeIsMultiline.get(node)

    if (tracked !== undefined) {
      return tracked
    }

    return false
  }

  /**
   * Get a grouping key for a node (tag name for HTML, ERB type for ERB)
   */
  private getGroupingKey(node: Node): string | null {
    if (isNode(node, HTMLElementNode)) {
      return getTagName(node)
    }

    if (isERBOutputNode(node)) return "erb-output"
    if (isERBCommentNode(node)) return "erb-comment"
    if (isERBNode(node)) return "erb-code"

    return null
  }

  /**
   * Detect groups of consecutive same-tag/same-type single-line elements
   * Returns a map of index -> group info for efficient lookup
   */
  private detectTagGroups(siblings: Node[]): Map<number, { tagName: string; groupStart: number; groupEnd: number }> {
    const cached = this.tagGroupsCache.get(siblings)
    if (cached) return cached

    const groupMap = new Map<number, { tagName: string; groupStart: number; groupEnd: number }>()
    const meaningfulNodes: Array<{ index: number; groupKey: string }> = []

    for (let i = 0; i < siblings.length; i++) {
      const node = siblings[i]

      if (!this.isMultilineElement(node)) {
        const groupKey = this.getGroupingKey(node)

        if (groupKey) {
          meaningfulNodes.push({ index: i, groupKey })
        }
      }
    }

    let groupStart = 0

    while (groupStart < meaningfulNodes.length) {
      const startGroupKey = meaningfulNodes[groupStart].groupKey
      let groupEnd = groupStart

      while (groupEnd + 1 < meaningfulNodes.length && meaningfulNodes[groupEnd + 1].groupKey === startGroupKey) {
        groupEnd++
      }

      if (groupEnd > groupStart) {
        const groupStartIndex = meaningfulNodes[groupStart].index
        const groupEndIndex = meaningfulNodes[groupEnd].index

        for (let i = groupStart; i <= groupEnd; i++) {
          groupMap.set(meaningfulNodes[i].index, {
            tagName: startGroupKey,
            groupStart: groupStartIndex,
            groupEnd: groupEndIndex
          })
        }
      }

      groupStart = groupEnd + 1
    }

    this.tagGroupsCache.set(siblings, groupMap)

    return groupMap
  }
}
