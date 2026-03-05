import { isNode, getTagName, isERBCommentNode, isPureWhitespaceNode } from "@herb-tools/core"
import { Node, HTMLTextNode, HTMLElementNode, ERBContentNode, WhitespaceNode } from "@herb-tools/core"

import type { ContentUnitWithNode } from "./format-helpers.js"

import {
  hasWhitespaceBetween,
  isHerbDisableComment,
  isInlineElement,
  isLineBreakingElement,
} from "./format-helpers.js"

import {
  hasWhitespaceBeforeNode as hasWhitespaceBeforeNodeHelper,
  lastUnitEndsWithWhitespace as lastUnitEndsWithWhitespaceHelper,
  tryMergeAtomicAfterText as tryMergeAtomicAfterTextHelper,
  tryMergeTextAfterAtomic as tryMergeTextAfterAtomicHelper,
} from "./text-flow-helpers.js"

/**
 * Interface that the delegate must implement to provide
 * rendering capabilities to the TextFlowAnalyzer.
 */
export interface TextFlowAnalyzerDelegate {
  tryRenderInlineElement(element: HTMLElementNode): string | null
  renderERBAsString(node: ERBContentNode): string
}

/**
 * TextFlowAnalyzer converts AST nodes into the ContentUnitWithNode[]
 * intermediate representation used by the TextFlowEngine for rendering.
 */
export class TextFlowAnalyzer {
  private delegate: TextFlowAnalyzerDelegate

  constructor(delegate: TextFlowAnalyzerDelegate) {
    this.delegate = delegate
  }

  buildContentUnits(children: Node[]): ContentUnitWithNode[] {
    const result: ContentUnitWithNode[] = []
    let lastProcessedIndex = -1

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (isNode(child, WhitespaceNode)) continue

      if (isPureWhitespaceNode(child) && !(isNode(child, HTMLTextNode) && child.content === ' ')) {
        if (lastProcessedIndex >= 0) {
          const hasNonWhitespaceAfter = children.slice(i + 1).some(node =>
            !isNode(node, WhitespaceNode) && !isPureWhitespaceNode(node)
          )

          if (hasNonWhitespaceAfter) {
            const previousNode = children[lastProcessedIndex]

            if (!isLineBreakingElement(previousNode)) {
              result.push({
                unit: { content: ' ', type: 'text', isAtomic: true, breaksFlow: false },
                node: child
              })
            }
          }
        }

        continue
      }

      if (isNode(child, HTMLTextNode)) {
        this.processTextNode(result, children, child, i, lastProcessedIndex)

        lastProcessedIndex = i
      } else if (isNode(child, HTMLElementNode)) {
        const tagName = getTagName(child)

        if (isInlineElement(tagName)) {
          const merged = this.processInlineElement(result, children, child, i, lastProcessedIndex)

          if (merged) {
            lastProcessedIndex = i

            continue
          }
        } else {
          result.push({
            unit: { content: '', type: 'block', isAtomic: false, breaksFlow: true },
            node: child
          })
        }

        lastProcessedIndex = i
      } else if (isNode(child, ERBContentNode)) {
        const merged = this.processERBContentNode(result, children, child, i, lastProcessedIndex)

        if (merged) {
          lastProcessedIndex = i

          continue
        }

        lastProcessedIndex = i
      } else {
        result.push({
          unit: { content: '', type: 'block', isAtomic: false, breaksFlow: true },
          node: child
        })

        lastProcessedIndex = i
      }
    }

    return result
  }

  private processTextNode(result: ContentUnitWithNode[], children: Node[], child: HTMLTextNode, index: number, lastProcessedIndex: number): void {
    const isAtomic = child.content === ' '

    if (!isAtomic && lastProcessedIndex >= 0 && result.length > 0) {
      const hasWhitespace = hasWhitespaceBeforeNodeHelper(children, lastProcessedIndex, index, child)
      const lastUnit = result[result.length - 1]
      const lastIsAtomic = lastUnit.unit.isAtomic && (lastUnit.unit.type === 'erb' || lastUnit.unit.type === 'inline')

      if (lastIsAtomic && !hasWhitespace && tryMergeTextAfterAtomicHelper(result, child)) {
        return
      }
    }

    result.push({
      unit: { content: child.content, type: 'text', isAtomic, breaksFlow: false },
      node: child
    })
  }

  private processInlineElement(result: ContentUnitWithNode[], children: Node[], child: HTMLElementNode, index: number, lastProcessedIndex: number): boolean {
    const inlineContent = this.delegate.tryRenderInlineElement(child)

    if (inlineContent === null) {
      result.push({
        unit: { content: '', type: 'block', isAtomic: false, breaksFlow: true },
        node: child
      })

      return false
    }

    if (lastProcessedIndex >= 0) {
      const hasWhitespace = hasWhitespaceBetween(children, lastProcessedIndex, index) || lastUnitEndsWithWhitespaceHelper(result)

      if (!hasWhitespace && tryMergeAtomicAfterTextHelper(result, children, lastProcessedIndex, inlineContent, 'inline', child)) {
        return true
      }
    }

    result.push({
      unit: { content: inlineContent, type: 'inline', isAtomic: true, breaksFlow: false },
      node: child
    })

    return false
  }

  private processERBContentNode(result: ContentUnitWithNode[], children: Node[], child: ERBContentNode, index: number, lastProcessedIndex: number): boolean {
    const erbContent = this.delegate.renderERBAsString(child)
    const herbDisable = isHerbDisableComment(child)

    if (lastProcessedIndex >= 0) {
      const hasWhitespace = hasWhitespaceBetween(children, lastProcessedIndex, index) || lastUnitEndsWithWhitespaceHelper(result)

      if (!hasWhitespace && tryMergeAtomicAfterTextHelper(result, children, lastProcessedIndex, erbContent, 'erb', child)) {
        return true
      }

      if (hasWhitespace && result.length > 0) {
        const lastUnit = result[result.length - 1]
        const lastIsAtomic = lastUnit.unit.isAtomic && (lastUnit.unit.type === 'inline' || lastUnit.unit.type === 'erb')

        if (lastIsAtomic && !lastUnitEndsWithWhitespaceHelper(result)) {
          result.push({
            unit: { content: ' ', type: 'text', isAtomic: true, breaksFlow: false },
            node: null
          })
        }
      }
    }

    result.push({
      unit: { content: erbContent, type: 'erb', isAtomic: true, breaksFlow: false, isHerbDisable: herbDisable },
      node: child
    })

    if (isERBCommentNode(child) && !herbDisable) {
      for (let j = index + 1; j < children.length; j++) {
        const nextChild = children[j]
        if (isNode(nextChild, WhitespaceNode)) continue
        if (isPureWhitespaceNode(nextChild)) continue

        const hasNewlineBefore = isNode(nextChild, HTMLTextNode) && /\n/.test(nextChild.content.split(/\S/)[0] || '')
        if (nextChild.location.start.line > child.location.end.line || hasNewlineBefore) {
          result.push({
            unit: { content: '', type: 'text', isAtomic: false, breaksFlow: true },
            node: null
          })
        }

        break
      }
    }

    return false
  }
}
