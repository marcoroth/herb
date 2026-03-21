import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { createLiteral } from "@herb-tools/core"

import { isERBStrictLocalsNode, isHTMLTextNode } from "@herb-tools/core"
import { isPartialFile } from "./file-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, DocumentNode, ERBStrictLocalsNode, HTMLTextNode } from "@herb-tools/core"

class ERBStrictLocalsFirstLineVisitor extends BaseRuleVisitor {

  visitDocumentNode(node: DocumentNode) {
    const { children } = node

    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (!isERBStrictLocalsNode(child)) continue

      const next = children[i + 1]
      if (!next) break

      if (isHTMLTextNode(next)) {
        if (!next.content.startsWith("\n\n") && children[i + 2]) {
          this.addOffense(
            "Add a blank line after the strict locals declaration.",
            child.location
          )
        }
      } else {
        this.addOffense(
          "Add a blank line after the strict locals declaration.",
          child.location
        )
      }

      break
    }

    this.visitChildNodes(node)
  }

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    if (isPartialFile(this.context.fileName) !== true) return

    if (node.location.start.line !== 1) {
      this.addOffense(
        "Strict locals declaration must be on the first line of the partial.",
        node.location
      )
    }
  }
}

export class ERBStrictLocalsFirstLineRule extends ParserRule {
  static autocorrectable = true
  static ruleName = "erb-strict-locals-first-line"

  get parserOptions() {
    return { strict_locals: true }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error",
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    if (isPartialFile(context?.fileName) !== true) return []

    const visitor = new ERBStrictLocalsFirstLineVisitor(this.ruleName, context)
    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense, result: ParseResult): ParseResult | null {
    const children = result.value.children

    const index = children.findIndex(child =>
      child.location.start.line === offense.location.start.line &&
      child.location.start.column === offense.location.start.column
    )

    if (index === -1) return null

    if (offense.location.start.line === 1) {
      const next = children[index + 1]

      if (isHTMLTextNode(next)) {
        children.splice(index + 1, 1, createLiteral("\n\n"))
      } else {
        children.splice(index + 1, 0, createLiteral("\n\n"))
      }
    } else {
      const [node] = children.splice(index, 1)

      if (index > 0) {
        const previous = children[index - 1]

        if (isHTMLTextNode(previous) && /^\s*$/.test(previous.content)) {
          children.splice(index - 1, 1)
        }
      }

      const firstChild = children[0]

      if (!firstChild || !isHTMLTextNode(firstChild) || !firstChild.content.startsWith("\n\n")) {
        children.unshift(createLiteral("\n\n"))
      }

      children.unshift(node)
    }

    return result
  }
}
