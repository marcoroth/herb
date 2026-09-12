import { PrismVisitor, locationFromByteOffset } from "@herb-tools/core"

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
  private readonly source: string

  constructor(ruleName: string, context: Partial<LintContext> | undefined, scopes: StatementsScope[], source: string) {
    super(ruleName, context)

    this.scopes = scopes
    this.source = source
  }

  visitERBContentNode(node: ERBContentNode): void {
    if (node.location.start.line !== node.location.end.line) return
    if (node.tag_opening?.value === "<%#") return

    const contentRange = node.content?.range

    if (!contentRange) return

    const statements = this.shallowestStatementsIn(contentRange.from, contentRange.to)

    if (statements.length <= 1) return

    for (const statement of statements.slice(1)) {
      const { startOffset, length } = statement.location

      this.addOffense(
        `Avoid multiple Ruby statements in a single-line ERB tag. Move this statement into its own ERB tag for better readability.`,
        locationFromByteOffset(this.source, startOffset, length),
      )
    }
  }

  private shallowestStatementsIn(from: number, to: number): PrismNodes.Node[] {
    let shallowestDepth = Infinity
    let statements: PrismNodes.Node[] = []

    for (const scope of this.scopes) {
      if (scope.depth > shallowestDepth) continue

      const inRange = scope.statements.filter(statement => {
        const statementOffset = statement.location.startOffset

        return statementOffset >= from && statementOffset < to
      })

      if (inRange.length === 0) continue

      if (scope.depth < shallowestDepth) {
        shallowestDepth = scope.depth
        statements = inRange
      } else {
        statements = statements.concat(inRange)
      }
    }

    return statements.sort((left, right) => left.location.startOffset - right.location.startOffset)
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
    const source = result.value.source

    if (!program || !source) return []

    const collector = new StatementsCollector()

    collector.visit(program)

    if (collector.scopes.length === 0) return []

    const visitor = new NoMultipleStatementsVisitor(this.ruleName, context, collector.scopes, source)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
