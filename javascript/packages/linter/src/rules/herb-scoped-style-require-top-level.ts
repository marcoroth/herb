import { getTagLocalName, hasAttribute } from "@herb-tools/core"

import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { ParseResult, DocumentNode, HTMLElementNode, Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class ScopedStyleRequireTopLevelVisitor extends BaseRuleVisitor {
  private topLevel = new Set<Node>()

  visitDocumentNode(node: DocumentNode): void {
    this.topLevel = new Set(node.children)

    this.visitChildNodes(node)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    const isScopedStyle = getTagLocalName(node) === "style" && hasAttribute(node, "scoped")

    if (isScopedStyle && !this.topLevel.has(node)) {
      this.addOffense(
        "A `<style scoped>` block styles the whole file it was written in, not the element it is nested in. Move it to the top level of the file, so where it sits reads like what it applies to.",
        node.open_tag!.location,
      )
    }

    super.visitHTMLElementNode(node)
  }
}

export class HerbScopedStyleRequireTopLevelRule extends ParserRule {
  static ruleName = "herb-scoped-style-require-top-level"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ScopedStyleRequireTopLevelVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
