import { isERBOutputNode, PrismNode } from "@herb-tools/core"
import type { ParseResult, ERBContentNode, ParserOptions } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

const LITERAL_NODE_TYPES = new Set([
  "ArrayNode",
  "FalseNode",
  "FloatNode",
  "HashNode",
  "ImaginaryNode",
  "IntegerNode",
  "NilNode",
  "RangeNode",
  "RationalNode",
  "RegularExpressionNode",
  "StringNode",
  "SymbolNode",
  "TrueNode",
])

function isLiteralPrismNode(prismNode: PrismNode): boolean {
  const type: string = prismNode?.constructor?.name
  if (!type) return false

  return LITERAL_NODE_TYPES.has(type)
}

class ERBNoUnusedLiteralsVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode || !isLiteralPrismNode(prismNode)) return

    const content = node.content?.value?.trim()
    if (!content) return

    this.addOffense(
      `Avoid using silent ERB tags for literals. \`${content}\` is evaluated but never used or output.`,
      node.location,
    )
  }
}

export class ERBNoUnusedLiteralsRule extends ParserRule {
  static ruleName = "erb-no-unused-literals"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoUnusedLiteralsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
