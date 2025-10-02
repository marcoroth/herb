import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { ParseResult, HTMLOpenTagNode, HTMLCloseTagNode, WhitespaceNode } from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"

class HTMLNoSpaceInTagVisitor extends BaseRuleVisitor {

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (!node.tag_name || !node.tag_opening || !node.tag_closing) { return }

    const isMultiline = !node.isSingleLine
    const whiteSpaceNodes : WhitespaceNode[] = node.children.filter((child): child is WhitespaceNode => child.type === "AST_WHITESPACE_NODE")

    if (isMultiline) {
      // If is multiline 
      // 1. All whitespace node that are not line breaks should have 2 whitespace
      // 2. The last whitespace should be a line break
      // 3. There can't be newlines between (line break after line break)

      const lastIndex = whiteSpaceNodes.length - 1

      let previousWhitespace : WhitespaceNode | null = null;
      whiteSpaceNodes.forEach((whitespace, index) => {
        if (!whitespace.value) { return }

        if(whitespace.value.value === "\n") {
          if (previousWhitespace && previousWhitespace.value && previousWhitespace.value.value === "\n") {
            this.addOffense("Extra space detected where there should be no space.", whitespace.location)
          }
        } else {
          if (index  === lastIndex) {
            this.addOffense("Extra space detected where there should be no space.", whitespace.location)
          } else {
            if (whitespace.value.value.length > 2) {
              this.addOffense("Extra space detected where there should be no space.", whitespace.location)
            }
          }
        }

        previousWhitespace = whitespace
      })

    } else {
      // If is single line
      // 1. All whitespace should have 1 space
      // 2. There should be no trailing whitespace

      whiteSpaceNodes.forEach((whitespaceNode) => {
        if (!whitespaceNode.value) { return }
        if (whitespaceNode.value.value.length > 1) {
          this.addOffense("Extra space detected where there should be no space.", whitespaceNode.location)
        }
      })

      const whitespaceChildren = node.children.filter((child) => child.type === "AST_WHITESPACE_NODE")
      if (whitespaceChildren.length > 2) {
        const lastChildren = node.children[node.children.length - 1]
        if (lastChildren.type === "AST_WHITESPACE_NODE") {
          const whitespaceNode = lastChildren as WhitespaceNode
          if (whitespaceNode.value?.value.length == 1) {
            this.addOffense("Extra space detected where there should be no space.", lastChildren.location)
          }
        }
      }
    }
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    if (!node.tag_opening || !node.tag_name || !node.tag_closing) {
      return
    }

    const whitespaceNodes = node.children.filter((child) : child is WhitespaceNode => child.type === "AST_WHITESPACE_NODE")
    whitespaceNodes.forEach((whitespace) => {
      this.addOffense("Extra space detected where there should be no space.", whitespace.location)
    })
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
