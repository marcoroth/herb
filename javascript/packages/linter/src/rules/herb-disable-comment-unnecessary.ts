import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbDisableComment } from "../herb-disable-comment-utils.js"

class HerbDisableCommentUnnecessaryVisitor extends HerbDisableCommentParsedVisitor {
  private ignoredOffensesByLine: Map<number, Set<string>>
  private validRuleNames: Set<string>

  constructor(ruleName: string, ignoredOffensesByLine: Map<number, Set<string>>, validRuleNames: string[], context?: Partial<LintContext>) {
    super(ruleName, context)

    this.ignoredOffensesByLine = ignoredOffensesByLine
    this.validRuleNames = new Set([...validRuleNames, "all"])
  }

  protected checkParsedHerbDisable(node: ERBContentNode, _content: string, herbDisable: HerbDisableComment): void {
    const line = node.location.start.line
    const usedRuleNames = this.ignoredOffensesByLine.get(line) || new Set<string>()

    if (herbDisable.ruleNames.includes("all")) {
      if (herbDisable.ruleNames.length > 1) return
      if (usedRuleNames.size > 0) return

      this.addOffense(
        `No offenses to disable on this line. Remove the \`herb:disable all\` comment.`,
        node.location,
      )

      return
    }

    const unnecessaryRules = herbDisable.ruleNameDetails.filter(
      detail => this.validRuleNames.has(detail.name) && !usedRuleNames.has(detail.name)
    )

    if (unnecessaryRules.length === 0) return

    const validRuleCount = herbDisable.ruleNames.filter(name => this.validRuleNames.has(name)).length

    if (unnecessaryRules.length === validRuleCount) {
      if (unnecessaryRules.length === 1) {
        const ruleName = unnecessaryRules[0].name

        this.addOffense(
          `No offenses from \`${ruleName}\` on this line. Remove the \`herb:disable\` comment.`,
          node.location,
        )

        return
      }

      const unnecessaryRuleNames = unnecessaryRules.map(rule => `\`${rule.name}\``).join(", ")

      this.addOffense(
        `No offenses from rules ${unnecessaryRuleNames} on this line. Remove them from the \`herb:disable\` comment.`,
        node.location,
      )

      return
    }

    for (const unnecessaryRule of unnecessaryRules) {
      const location = this.createRuleNameLocation(node, unnecessaryRule)
      const message = `No offenses from \`${unnecessaryRule.name}\` on this line. Remove it from the \`herb:disable\` comment.`

      this.addOffenseWithFallback(message, location, node)
    }
  }
}

export class HerbDisableCommentUnnecessaryRule extends ParserRule {
  name = "herb-disable-comment-unnecessary"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const validRuleNames = context?.validRuleNames
    const ignoredOffensesByLine = context?.ignoredOffensesByLine

    if (!validRuleNames) return []
    if (validRuleNames.length === 0) return []
    if (!ignoredOffensesByLine) return []

    const visitor = new HerbDisableCommentUnnecessaryVisitor(
      this.name,
      ignoredOffensesByLine,
      validRuleNames,
      context
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
