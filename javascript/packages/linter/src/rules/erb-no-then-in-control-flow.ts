import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBIfNode, ERBUnlessNode, ERBWhenNode, ERBInNode, ParseResult, ParserOptions, Location } from "@herb-tools/core"

class ERBNoThenInControlFlowVisitor extends BaseRuleVisitor {
  visitERBIfNode(node: ERBIfNode): void {
    const content = node.content?.value?.trim() ?? ""
    const keyword = content.startsWith("elsif") ? "elsif" : "if"

    this.checkThenKeyword(keyword, node.then_keyword)
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.checkThenKeyword("unless", node.then_keyword)
    this.visitChildNodes(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.checkThenKeyword("when", node.then_keyword)
    this.visitChildNodes(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.checkThenKeyword("in", node.then_keyword)
    this.visitChildNodes(node)
  }

  private checkThenKeyword(keyword: string, thenKeyword: Location | null): void {
    if (thenKeyword === null) return

    this.addOffense(
      `Avoid using \`then\` in \`${keyword}\` expressions inside ERB templates. Use the multiline block form instead.`,
      thenKeyword,
    )
  }
}

export class ERBNoThenInControlFlowRule extends ParserRule {
  static ruleName = "erb-no-then-in-control-flow"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return { strict: true }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoThenInControlFlowVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
