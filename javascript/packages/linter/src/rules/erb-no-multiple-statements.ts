import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"

function collectStatements(programNode: PrismNode): PrismNode[] {
  const statements = programNode?.statements?.body

  if (!Array.isArray(statements)) return []

  return statements
}

class NoMultipleStatementsVisitor extends BaseRuleVisitor {
  private readonly statements: PrismNode[]

  constructor(ruleName: string, context: Partial<LintContext> | undefined, statements: PrismNode[]) {
    super(ruleName, context)

    this.statements = statements
  }

  visitERBContentNode(node: ERBContentNode): void {
    const startLine = node.location.start.line
    const endLine = node.location.end.line
    if (startLine !== endLine) return

    const tagOpening = node.tag_opening?.value
    if (tagOpening === "<%#") return

    const contentRange = node.content?.range
    if (!contentRange) return

    const rangeStart = contentRange.start
    const rangeEnd = contentRange.end

    let statementCount = 0

    for (const statement of this.statements) {
      const statementOffset = statement.location.startOffset

      if (statementOffset >= rangeStart && statementOffset < rangeEnd) {
        statementCount++
      }
    }

    if (statementCount <= 1) return

    this.addOffense(
      `Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.`,
      node.location,
    )
  }
}

export class ERBNoMultipleStatementsRule extends ParserRule {
  static ruleName = "erb-no-multiple-statements"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const documentPrismNode = result.value.prismNode
    if (!documentPrismNode) return []

    const statements = collectStatements(documentPrismNode)
    if (statements.length === 0) return []

    const visitor = new NoMultipleStatementsVisitor(this.ruleName, context, statements)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
