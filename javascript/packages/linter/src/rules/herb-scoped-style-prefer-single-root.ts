import { getTagLocalName, hasAttribute, isHTMLElementNode } from "@herb-tools/core"

import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { ParseResult, DocumentNode, HTMLElementNode, Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const UNSCOPABLE = ["style", "script"]

class ScopedStylePreferSingleRootVisitor extends BaseRuleVisitor {
  visitDocumentNode(node: DocumentNode): void {
    const scopedStyle = this.topLevelScopedStyle(node.children)

    if (scopedStyle) {
      const roots = node.children.filter((child) => this.isRoot(child))

      if (roots.length > 1) {
        this.addOffense(
          `A \`<style scoped>\` block reads best with a single root element. Wrap the ${roots.length} top-level elements in one element, so the scoped styles apply within a single root.`,
          scopedStyle.open_tag!.location,
        )
      }
    }

    this.visitChildNodes(node)
  }

  private topLevelScopedStyle(children: Node[]): HTMLElementNode | null {
    for (const child of children) {
      if (isHTMLElementNode(child) && getTagLocalName(child) === "style" && hasAttribute(child, "scoped")) {
        return child
      }
    }

    return null
  }

  private isRoot(node: Node): boolean {
    return isHTMLElementNode(node) && !UNSCOPABLE.includes(getTagLocalName(node) ?? "")
  }
}

export class HerbScopedStylePreferSingleRootRule extends ParserRule {
  static ruleName = "herb-scoped-style-prefer-single-root"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ScopedStylePreferSingleRootVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
