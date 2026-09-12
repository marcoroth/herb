import { PrismVisitor } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "../utils/rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ParserOptions, PrismNodes } from "@herb-tools/core"

type StatementsScope = {
  depth: number
  statements: PrismNodes.Node[]
}

class StatementsCollector extends PrismVisitor {
  readonly scopes: StatementsScope[] = []

  private depth = 0

  override visitStatementsNode(node: PrismNodes.StatementsNode): void {
    this.scopes.push({ depth: this.depth, statements: node.body })

    this.depth++
    this.visitChildNodes(node)
    this.depth--
  }
}

class NoMultipleStatementsVisitor extends BaseRuleVisitor {
  private readonly scopes: StatementsScope[]

  constructor(ruleName: string, context: Partial<LintContext> | undefined, scopes: StatementsScope[]) {
    super(ruleName, context)

    this.scopes = scopes
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.location.start.line !== node.location.end.line) return
    if (node.tag_opening?.value === "<%#") return

    const contentRange = node.content?.range

    if (!contentRange) return

    const statementCount = this.shallowestStatementCountIn(contentRange.from, contentRange.to)

    if (statementCount <= 1) return

    this.addOffense(
      `Avoid multiple Ruby statements in a single-line ERB tag. Split each statement into its own ERB tag for better readability.`,
      node.location,
    )
  }

  private shallowestStatementCountIn(from: number, to: number): number {
    let shallowestDepth = Infinity
    let statementCount = 0

    for (const scope of this.scopes) {
      if (scope.depth > shallowestDepth) continue

      const count = scope.statements.filter(statement => {
        const statementOffset = statement.location.startOffset

        return statementOffset >= from && statementOffset < to
      }).length

      if (count === 0) continue

      if (scope.depth < shallowestDepth) {
        shallowestDepth = scope.depth
        statementCount = count
      } else {
        statementCount += count
      }
    }

    return statementCount
  }
}

export class ERBNoMultipleStatementsRule extends ParserRule {
  static ruleName = "erb-no-multiple-statements"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const program = result.value.prismNode

    if (!program) return []

    const collector = new StatementsCollector()

    collector.visit(program)

    if (collector.scopes.length === 0) return []

    const visitor = new NoMultipleStatementsVisitor(this.ruleName, context, collector.scopes)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
