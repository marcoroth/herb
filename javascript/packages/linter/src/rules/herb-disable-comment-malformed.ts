import { ParserRule } from "../types.js"
import { HerbDisableCommentBaseVisitor } from "./herb-disable-comment-base.js"
import { parseHerbDisableContent } from "../herb-disable-comment-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ERBContentNode, ParseResult } from "@herb-tools/core"

class HerbDisableCommentMalformedVisitor extends HerbDisableCommentBaseVisitor {
  protected checkHerbDisableComment(node: ERBContentNode, content: string): void {
    const trimmed = content.trim()
    const looksLikeHerbDisable = trimmed.startsWith("herb:disable")
    if (!looksLikeHerbDisable) return

    if (trimmed.length > "herb:disable".length) {
      const charAfterPrefix = trimmed["herb:disable".length]

      if (charAfterPrefix !== ' ' && charAfterPrefix !== '\t' && charAfterPrefix !== '\n') {
        this.addOffense(
          "`herb:disable` comment is missing a space after `herb:disable`. Add a space before the rule names.",
          node.location,
        )

        return
      }
    }

    const afterPrefix = trimmed.substring("herb:disable".length).trim()
    if (afterPrefix.length === 0) return

    const parsed = parseHerbDisableContent(content)
    if (parsed !== null) return

    let message = "`herb:disable` comment is malformed."

    const rulesString = afterPrefix.trim()

    if (rulesString.endsWith(',')) {
      message = "`herb:disable` comment has a trailing comma. Remove the trailing comma."
    } else if (rulesString.includes(',,') || rulesString.match(/,\s*,/)) {
      message = "`herb:disable` comment has consecutive commas. Remove extra commas."
    } else if (rulesString.startsWith(',')) {
      message = "`herb:disable` comment starts with a comma. Remove the leading comma."
    }

    this.addOffense(message, node.location)
  }
}

export class HerbDisableCommentMalformedRule extends ParserRule {
  name = "herb-disable-comment-malformed"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HerbDisableCommentMalformedVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
