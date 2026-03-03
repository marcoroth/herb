import { isLiteralNode, isWhitespaceLiteral, splitLiteralsAtWhitespace, groupNodesByClass } from "@herb-tools/core"
import { IdentityPrinter } from "@herb-tools/printer"

import { ParserRule } from "../types.js"
import { AttributeVisitorMixin } from "./rule-utils.js"

import type { Node } from "@herb-tools/core"
import type { StaticAttributeDynamicValueParams } from "./rule-utils.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult } from "@herb-tools/core"

function groupToString(group: Node[]): string {
  return group.map(node => {
    if (isLiteralNode(node)) {
      return node.content
    }

    return IdentityPrinter.print(node, { ignoreErrors: true })
  }).join("")
}

class ERBNoInterpolatedClassNamesVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes, attributeNode }: StaticAttributeDynamicValueParams) {
    if (attributeName !== "class") return

    const splitNodes = splitLiteralsAtWhitespace(valueNodes)
    const groups = groupNodesByClass(splitNodes)

    for (const group of groups) {
      if (group.every(node => isWhitespaceLiteral(node))) continue

      const isInterpolated = group.some(node => !isLiteralNode(node))
      if (!isInterpolated) continue

      const hasAttachedLiteral = group.some(node => isLiteralNode(node) && node.content.trim())
      if (!hasAttachedLiteral) continue

      const className = groupToString(group)

      this.addOffense(
        `Avoid ERB interpolation inside class names: \`${className}\`. Use standalone ERB expressions that output complete class names instead.`,
        attributeNode.value!.location,
      )
    }
  }
}

export class ERBNoInterpolatedClassNamesRule extends ParserRule {
  static ruleName = "erb-no-interpolated-class-names"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoInterpolatedClassNamesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
