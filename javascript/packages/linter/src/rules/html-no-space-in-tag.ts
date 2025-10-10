import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import {
  ParseResult,
  HTMLOpenTagNode,
  HTMLCloseTagNode,
  HTMLAttributeNode,
  WhitespaceNode,
  Node
} from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"

class HTMLNoSpaceInTagVisitor extends BaseRuleVisitor {
  private sourceContent: string

  constructor(code: string, sourceContent: string, context?: Partial<LintContext>) {
    super(code, context)
    this.sourceContent = sourceContent
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkOpenTag(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    // In close tags, check for any whitespace which shouldn't be there
    const whitespaceNodes = node.children.filter((child): child is WhitespaceNode =>
      child.type === "AST_WHITESPACE_NODE"
    )
    whitespaceNodes.forEach((whitespace) => {
      this.addOffense("Extra space detected where there should be no space.", whitespace.location)
    })
  }

  private checkOpenTag(node: HTMLOpenTagNode): void {
    if (node.isSingleLine) {
      this.checkSingleLineTag(node)
    } else {
      this.checkMultilineTag(node)
    }
  }

  private checkSingleLineTag(node: HTMLOpenTagNode): void {
    const { children, tag_closing } = node
    const attributes = children.filter((child): child is HTMLAttributeNode =>
      child.type === "AST_HTML_ATTRIBUTE_NODE"
    )

    // Check all whitespace nodes
    const whitespaceNodes = children.filter((child): child is WhitespaceNode =>
      child.type === "AST_WHITESPACE_NODE"
    )

    whitespaceNodes.forEach((ws) => {
      if (!ws.value) return
      const content = ws.value.value

      // Check if this whitespace is at the end (before closing >)
      const isLastChild = children[children.length - 1] === ws

      if (isLastChild) {
        // No trailing whitespace allowed
        this.addOffense("Extra space detected where there should be no space.", ws.location)
      } else if (content.length > 1) {
        // More than one space
        this.addOffense("Extra space detected where there should be a single space.", ws.location)
      } else if (content.match(/[^\s]/)) {
        // Non-whitespace character
        const nonSpaceMatch = content.match(/([^\s])/)
        if (nonSpaceMatch && nonSpaceMatch[1]) {
          this.addOffense(`Non-whitespace character(s) detected: "${nonSpaceMatch[1]}".`, ws.location)
        }
      }
    })

    // Check for missing spaces between attributes
    for (let i = 0; i < attributes.length - 1; i++) {
      const current = attributes[i]
      const next = attributes[i + 1]

      if (current.location.end.offset === next.location.start.offset) {
        // No space between attributes
        const location = {
          start: current.location.end,
          end: next.location.start
        }
        this.addOffense("No space detected where there should be a single space.", location)
      }
    }

    // Check for missing space before self-closing /
    if (tag_closing) {
      const closingText = this.sourceContent.slice(
        tag_closing.location.start.offset,
        tag_closing.location.end.offset
      )

      if (closingText.startsWith('/') || closingText === '/>') {
        // This is a self-closing tag
        const lastNonWhitespace = children.filter(child =>
          child.type !== "AST_WHITESPACE_NODE"
        ).pop()

        if (lastNonWhitespace &&
            lastNonWhitespace.location.end.offset === tag_closing.location.start.offset) {
          // No space before /
          const location = {
            start: lastNonWhitespace.location.end,
            end: tag_closing.location.start
          }
          this.addOffense("No space detected where there should be a single space.", location)
        }
      }
    }

    // Check for spaces within attribute (between name=value)
    attributes.forEach(attr => {
      const { name, equals, value } = attr

      // Check whitespace between name and equals
      if (name && equals) {
        const wsNodes = this.getWhitespaceBetween(name, equals, node)
        wsNodes.forEach(ws => {
          this.addOffense("Extra space detected where there should be no space.", ws.location)
        })
      }

      // Check whitespace between equals and value
      if (equals && value) {
        const wsNodes = this.getWhitespaceBetween(equals, value, node)
        wsNodes.forEach(ws => {
          this.addOffense("Extra space detected where there should be no space.", ws.location)
        })
      }
    })
  }

  private checkMultilineTag(node: HTMLOpenTagNode): void {
    const { children, tag_closing } = node
    const whitespaceNodes = children.filter((child): child is WhitespaceNode =>
      child.type === "AST_WHITESPACE_NODE"
    )

    let previousWhitespace: WhitespaceNode | null = null
    whitespaceNodes.forEach((whitespace, index) => {
      if (!whitespace.value) return

      const content = whitespace.value.value

      // Check for consecutive newlines
      if (content === "\n") {
        if (previousWhitespace && previousWhitespace.value && previousWhitespace.value.value === "\n") {
          this.addOffense("Extra space detected where there should be a single space or a single line break.", whitespace.location)
        }
      } else if (content.includes("\n")) {
        // Multiline whitespace - check if it has multiple newlines
        const newlines = content.match(/\n/g)
        if (newlines && newlines.length > 1) {
          this.addOffense("Extra space detected where there should be a single space or a single line break.", whitespace.location)
        }
      } else {
        // Non-newline whitespace in multiline tag
        // Should be indentation, check if it's appropriate
        const isLastWhitespace = index === whitespaceNodes.length - 1
        const expectedIndent = isLastWhitespace ? node.location.start.column : node.location.start.column + 2

        if (whitespace.location.end.column !== expectedIndent) {
          this.addOffense("Extra space detected where there should be no space.", whitespace.location)
        }
      }

      previousWhitespace = whitespace
    })

    // Check for missing spaces before self-closing /
    if (tag_closing) {
      const closingText = this.sourceContent.slice(
        tag_closing.location.start.offset,
        tag_closing.location.end.offset
      )

      if (closingText.startsWith('/') || closingText === '/>') {
        // Check if there's a newline before /
        const lastWs = whitespaceNodes[whitespaceNodes.length - 1]
        if (!lastWs || !lastWs.value?.value.includes('\n')) {
          // Check if there's at least a space
          const lastNonWhitespace = children.filter(child =>
            child.type !== "AST_WHITESPACE_NODE"
          ).pop()

          if (lastNonWhitespace &&
              lastNonWhitespace.location.end.offset === tag_closing.location.start.offset) {
            const location = {
              start: lastNonWhitespace.location.end,
              end: tag_closing.location.start
            }
            this.addOffense("No space detected where there should be a single space.", location)
          }
        }
      }
    }
  }

  private getWhitespaceBetween(node1: Node | { location: any }, node2: Node | { location: any }, parent: HTMLOpenTagNode): WhitespaceNode[] {
    const end1 = node1.location.end.offset
    const start2 = node2.location.start.offset

    return parent.children.filter((child): child is WhitespaceNode => {
      if (child.type !== "AST_WHITESPACE_NODE") return false
      const wsStart = child.location.start.offset
      const wsEnd = child.location.end.offset
      return wsStart >= end1 && wsEnd <= start2
    })
  }
}

export class HTMLNoSpaceInTagRule extends ParserRule {
  name = "html-no-space-in-tag"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLNoSpaceInTagVisitor(this.name, result.source, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
