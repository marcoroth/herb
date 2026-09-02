import { ParserRule } from "../types.js"
import { HerbDisableCommentParsedVisitor } from "./herb-disable-comment-base.js"

import { didyoumean } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"
import type { HerbDisableComment } from "../herb-disable-comment-utils.js"

class HerbDisableCommentValidRuleNameVisitor extends HerbDisableCommentParsedVisitor {
  private validRuleNames: Set<string> = new Set()
  private validRuleNamesList: string[] = []

  constructor(ruleName: string, validRuleNames: string[], context?: Partial<LintContext>) {
    super(ruleName, context)

    this.validRuleNames = new Set([...validRuleNames, "all"])
    this.validRuleNamesList = Array.from(this.validRuleNames)
  }

  protected checkParsedHerbDisable(node: ERBContentNode, _content: string, herbDisable: HerbDisableComment): void {
    const check = (name: string, offset: number, length: number) => {
      if (this.validRuleNames.has(name)) return

      const suggestion = didyoumean(name, this.validRuleNamesList)
      const message = suggestion
        ? `Unknown rule \`${name}\`. Did you mean \`${suggestion}\`?`
        : `Unknown rule \`${name}\`.`

      const location = this.createRuleNameLocation(node, { name, offset, length })
      this.addOffenseWithFallback(message, location, node)
    }

    herbDisable.ruleNameDetails.forEach(ruleDetail => {
      check(ruleDetail.name, ruleDetail.offset, ruleDetail.length)
    })

    herbDisable.fileScopedEntries.forEach(entry => {
      // `all` is not a valid rule name in the file-scoped form.
      check(entry.name, entry.nameOffset, entry.nameLength)
    })
  }
}

export class HerbDisableCommentValidRuleNameRule extends ParserRule {
  static ruleName = "herb-disable-comment-valid-rule-name"
  static introducedIn = this.version("0.8.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const validRuleNames = context?.validRuleNames

    if (!validRuleNames) return []
    if (validRuleNames.length === 0) return []

    const visitor = new HerbDisableCommentValidRuleNameVisitor(
      this.ruleName,
      validRuleNames,
      context
    )

    visitor.visit(result.value)

    return visitor.offenses
  }
}
