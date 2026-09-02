import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbDisableComment } from "../herb-disable-comment-utils.js"

class HerbDisableCommentNoDuplicateRulesVisitor extends HerbDisableCommentParsedVisitor {
  protected checkParsedHerbDisable(node: ERBContentNode, _content: string, herbDisable: HerbDisableComment): void {
    const seenRules = new Set<string>()

    const check = (name: string, offset: number, length: number) => {
      if (seenRules.has(name)) {
        const location = this.createRuleNameLocation(node, { name, offset, length })
        const message = `Duplicate rule \`${name}\` in \`herb:disable\` comment. Remove the duplicate.`
        this.addOffenseWithFallback(message, location, node)
        return
      }

      seenRules.add(name)
    }

    herbDisable.ruleNameDetails.forEach(ruleDetail => {
      check(ruleDetail.name, ruleDetail.offset, ruleDetail.length)
    })

    herbDisable.fileScopedEntries.forEach(entry => {
      check(entry.name, entry.nameOffset, entry.nameLength)
    })
  }
}

export class HerbDisableCommentNoDuplicateRulesRule extends ParserRule {
  static ruleName = "herb-disable-comment-no-duplicate-rules"
  static introducedIn = this.version("0.8.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbDisableCommentNoDuplicateRulesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
