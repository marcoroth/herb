import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { ParseResult, HTMLOpenTagNode, HTMLCloseTagNode, WhitespaceNode } from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"

class HTMLNoSpaceInTagVisitor extends BaseRuleVisitor {

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.isSingleLine) {
      this.checkSingleLineNode(node)
    } else {
      this.checkMultilineNode(node)
    }
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    const whitespaceNodes = node.children.filter((child) : child is WhitespaceNode => child.type === "AST_WHITESPACE_NODE")
    whitespaceNodes.forEach((whitespace) => {
      this.addOffense("Extra space detected where there should be no space.", whitespace.location)
    })
  }
  
  // 1. There can't be newlines between (line break after line break)
  // 2. All space whitespace should be for indentation
  // 3. All whitespace node that are not line breaks should have correct indentation
  private checkMultilineNode(node: HTMLOpenTagNode) {
    const whiteSpaceNodes : WhitespaceNode[] = this.getWhitespaceNodes(node)
    const lastIndex = whiteSpaceNodes.length - 1

    let previousWhitespace : WhitespaceNode | null = null;
    whiteSpaceNodes.forEach((whitespace, index) => {
      if (!whitespace.value) { return }

      if(whitespace.value.value === "\n") {
        if (previousWhitespace && previousWhitespace.value && previousWhitespace.value.value === "\n") {
          this.addOffense("Extra space detected where there should be no space.", whitespace.location)
        }
      } else {
        let indentationLocation = index == lastIndex ? node.location.start.column : node.location.start.column + 2
        if (!(whitespace.location.end.column === indentationLocation)) {
          this.addOffense("Extra space detected where there should be no space.", whitespace.location)
        }
      }

      previousWhitespace = whitespace
    })
  }

  // If is single line
  // 1. All whitespace should have 1 space
  // 2. There should be no trailing whitespace
  private checkSingleLineNode(node: HTMLOpenTagNode) {
    const checkNoExtraSpaces = () => {
      const whiteSpaceNodes : WhitespaceNode[] = this.getWhitespaceNodes(node)

      whiteSpaceNodes.forEach((whitespaceNode) => {
        if (!whitespaceNode.value) { return }
        if (whitespaceNode.value.value.length > 1) {
          this.addOffense("Extra space detected where there should be no space.", whitespaceNode.location)
        }
      })
    }

    const checkNoTrailingWhitespace = () => {
      const lastChildren = node.children[node.children.length - 1];
      if (!lastChildren) return
      if (!(lastChildren.type === "AST_WHITESPACE_NODE")) return
      const whitespace = lastChildren as WhitespaceNode
      if (!whitespace.value) { return }
      if (whitespace.value.value.length > 1) return // Already have an error because of extra whitespace.
      this.addOffense("Extra space detected where there should be no space.", lastChildren.location)
    }

    checkNoExtraSpaces();
    checkNoTrailingWhitespace();
  }

  private getWhitespaceNodes(node: HTMLOpenTagNode): WhitespaceNode[] {
    return node.children.filter((child): child is WhitespaceNode => child.type === "AST_WHITESPACE_NODE")
  }
}

export class HTMLNoSpaceInTagRule extends ParserRule {
  name = "html-no-space-in-tag"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLNoSpaceInTagVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
