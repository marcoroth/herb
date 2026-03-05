import { isNode, getTagName } from "@herb-tools/core"
import { Node, HTMLTextNode, HTMLElementNode, ERBContentNode, WhitespaceNode } from "@herb-tools/core"

import type { ContentUnitWithNode } from "./format-helpers.js"

import {
  ASCII_WHITESPACE,
  buildLineWithWord,
  countAdjacentInlineElements,
  isClosingPunctuation,
  isInlineElement,
  isLineBreakingElement,
  isPureWhitespaceNode,
  needsSpaceBetween,
} from "./format-helpers.js"

import {
  collectTextFlowRun as collectTextFlowRunHelper,
  isInTextFlowContext as isInTextFlowContextHelper,
  isTextFlowNode as isTextFlowNodeHelper,
  tryMergePunctuationText as tryMergePunctuationTextHelper,
} from "./text-flow-helpers.js"

import { TextFlowAnalyzer } from "./text-flow-analyzer.js"
import type { TextFlowAnalyzerDelegate } from "./text-flow-analyzer.js"

/**
 * Interface that the FormatPrinter implements to provide
 * rendering capabilities to the TextFlowEngine.
 */
export interface TextFlowDelegate extends TextFlowAnalyzerDelegate {
  readonly indent: string
  readonly maxLineLength: number

  push(line: string): void
  pushWithIndent(line: string): void
  renderInlineElementAsString(element: HTMLElementNode): string
  visit(node: Node): void
}

/**
 * TextFlowEngine handles the formatting of mixed text + inline elements + ERB content.
 *
 * It orchestrates analysis (via TextFlowAnalyzer) and rendering phases:
 * groups adjacent inline elements, and wraps words to fit within line length constraints.
 */
export class TextFlowEngine {
  private analyzer: TextFlowAnalyzer

  constructor(private delegate: TextFlowDelegate) {
    this.analyzer = new TextFlowAnalyzer(delegate)
  }

  visitTextFlowChildren(children: Node[]): void {
    const adjacentInlineCount = countAdjacentInlineElements(children)

    if (adjacentInlineCount >= 2) {
      const { processedIndices } = this.renderAdjacentInlineElements(children, adjacentInlineCount)
      this.visitRemainingChildrenAsTextFlow(children, processedIndices)

      return
    }

    this.buildAndWrapTextFlow(children)
  }

  isInTextFlowContext(children: Node[]): boolean {
    return isInTextFlowContextHelper(children)
  }

  collectTextFlowRun(body: Node[], startIndex: number): { nodes: Node[], endIndex: number } | null {
    return collectTextFlowRunHelper(body, startIndex)
  }

  isTextFlowNode(node: Node): boolean {
    return isTextFlowNodeHelper(node)
  }

  private renderAdjacentInlineElements(children: Node[], count: number, startIndex = 0, alreadyProcessed?: Set<number>): { processedIndices: Set<number>; lastIndex: number } {
    let inlineContent = ""
    let processedCount = 0
    let lastProcessedIndex = -1
    const processedIndices = new Set<number>()

    for (let index = startIndex; index < children.length && processedCount < count; index++) {
      const child = children[index]

      if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
        continue
      }

      if (alreadyProcessed?.has(index)) {
        continue
      }

      if (isNode(child, HTMLElementNode) && isInlineElement(getTagName(child))) {
        inlineContent += this.delegate.renderInlineElementAsString(child)
        processedCount++
        lastProcessedIndex = index
        processedIndices.add(index)

        if (inlineContent && isLineBreakingElement(child)) {
          this.delegate.pushWithIndent(inlineContent)
          inlineContent = ""
        }
      } else if (isNode(child, ERBContentNode)) {
        inlineContent += this.delegate.renderERBAsString(child)
        processedCount++
        lastProcessedIndex = index
        processedIndices.add(index)
      }
    }

    if (inlineContent && lastProcessedIndex >= 0) {
      for (let index = lastProcessedIndex + 1; index < children.length; index++) {
        const child = children[index]

        if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
          continue
        }

        if (alreadyProcessed?.has(index)) {
          break
        }

        if (isNode(child, ERBContentNode)) {
          inlineContent += this.delegate.renderERBAsString(child)
          processedIndices.add(index)
          lastProcessedIndex = index
          continue
        }

        if (isNode(child, HTMLTextNode)) {
          const trimmed = child.content.trim()

          if (trimmed && /^[.!?:;%]/.test(trimmed)) {
            const wrapWidth = this.delegate.maxLineLength - this.delegate.indent.length
            const result = tryMergePunctuationTextHelper(inlineContent, trimmed, wrapWidth, this.delegate.indent)

            inlineContent = result.mergedContent
            processedIndices.add(index)
            lastProcessedIndex = index

            if (result.shouldStop) {
              if (inlineContent) {
                this.delegate.pushWithIndent(inlineContent)
              }

              result.wrappedLines.forEach(line => this.delegate.push(line))

              return { processedIndices, lastIndex: lastProcessedIndex }
            }
          }
        }

        break
      }
    }

    if (inlineContent) {
      this.delegate.pushWithIndent(inlineContent)
    }

    return {
      processedIndices,
      lastIndex: lastProcessedIndex >= 0 ? lastProcessedIndex : startIndex + count - 1
    }
  }

  private visitRemainingChildrenAsTextFlow(children: Node[], processedIndices: Set<number>): void {
    let index = 0
    let textFlowBuffer: Node[] = []

    const flushTextFlow = () => {
      if (textFlowBuffer.length > 0) {
        this.buildAndWrapTextFlow(textFlowBuffer)
        textFlowBuffer = []
      }
    }

    while (index < children.length) {
      const child = children[index]

      if (processedIndices.has(index)) {
        index++
        continue
      }

      if (isPureWhitespaceNode(child) || isNode(child, WhitespaceNode)) {
        textFlowBuffer.push(child)
        index++
        continue
      }

      const adjacentCount = countAdjacentInlineElements(children, index, processedIndices)

      if (adjacentCount >= 2) {
        flushTextFlow()

        const { processedIndices: newProcessedIndices, lastIndex } =
          this.renderAdjacentInlineElements(children, adjacentCount, index, processedIndices)

        newProcessedIndices.forEach(i => processedIndices.add(i))
        index = lastIndex + 1
      } else {
        textFlowBuffer.push(child)
        index++
      }
    }

    flushTextFlow()
  }

  private buildAndWrapTextFlow(children: Node[]): void {
    const unitsWithNodes: ContentUnitWithNode[] = this.analyzer.buildContentUnits(children)
    const words: Array<{ word: string, isHerbDisable: boolean }> = []

    if (process.env.DEBUG_FLOW) {
      console.log('UNITS: ' + JSON.stringify(unitsWithNodes.map(u => ({ t: u.unit.type, c: u.unit.content.substring(0, 60), a: u.unit.isAtomic, b: u.unit.breaksFlow }))))
    }

    for (const { unit, node } of unitsWithNodes) {
      if (unit.breaksFlow) {
        this.flushWords(words)

        if (node) {
          this.delegate.visit(node)
        }
      } else if (unit.isAtomic) {
        words.push({ word: unit.content, isHerbDisable: unit.isHerbDisable || false })
      } else {
        const text = unit.content.replace(ASCII_WHITESPACE, ' ')
        const hasLeadingSpace = text.startsWith(' ')
        const hasTrailingSpace = text.endsWith(' ')
        const trimmedText = text.trim()

        if (trimmedText) {
          if (hasLeadingSpace && words.length > 0) {
            const lastWord = words[words.length - 1]

            if (!lastWord.word.endsWith(' ')) {
              lastWord.word += ' '
            }
          }

          const textWords = trimmedText.split(' ').map(w => ({ word: w, isHerbDisable: false }))
          words.push(...textWords)

          if (hasTrailingSpace && words.length > 0) {
            const lastWord = words[words.length - 1]

            if (!isClosingPunctuation(lastWord.word)) {
              lastWord.word += ' '
            }
          }
        } else if (text === ' ' && words.length > 0) {
          const lastWord = words[words.length - 1]

          if (!lastWord.word.endsWith(' ')) {
            lastWord.word += ' '
          }
        }
      }
    }

    // Trim trailing space from last word before final flush - trailing spaces are
    // informational for spacing with subsequent words but shouldn't inflate
    // effective length when it's the final word (it gets trimmed from output anyway)
    if (words.length > 0) {
      words[words.length - 1].word = words[words.length - 1].word.trimEnd()
    }

    this.flushWords(words)
  }

  private flushWords(words: Array<{ word: string, isHerbDisable: boolean }>): void {
    if (words.length > 0) {
      this.wrapAndPushWords(words)
      words.length = 0
    }
  }

  private wrapAndPushWords(words: Array<{ word: string, isHerbDisable: boolean }>): void {
    const wrapWidth = this.delegate.maxLineLength - this.delegate.indent.length
    const lines: string[] = []
    let currentLine = ""
    let effectiveLength = 0

    for (const { word, isHerbDisable } of words) {
      const nextLine = buildLineWithWord(currentLine, word)

      let nextEffectiveLength = effectiveLength

      if (!isHerbDisable) {
        const spaceBefore = currentLine && needsSpaceBetween(currentLine, word) ? 1 : 0
        nextEffectiveLength = effectiveLength + spaceBefore + word.length
      }

      if (currentLine && !isClosingPunctuation(word) && nextEffectiveLength > wrapWidth) {
        lines.push(this.delegate.indent + currentLine.trim())

        currentLine = word
        effectiveLength = isHerbDisable ? 0 : word.length
      } else {
        currentLine = nextLine
        effectiveLength = nextEffectiveLength
      }
    }

    if (currentLine) {
      lines.push(this.delegate.indent + currentLine.trim())
    }

    lines.forEach(line => this.delegate.push(line))
  }
}
