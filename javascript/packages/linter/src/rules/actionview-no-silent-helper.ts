import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBOpenTagNode, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLElementNode, ParserOptions } from "@herb-tools/core"

class ActionViewNoSilentHelperVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkActionViewHelper(node)
    super.visitHTMLElementNode(node)
  }

  private checkActionViewHelper(node: HTMLElementNode): void {
    if (!node.element_source || node.element_source === "HTML") return
    if (!isERBOpenTagNode(node.open_tag)) return
    if (isERBOutputNode(node.open_tag)) return

    const tagOpening = node.open_tag.tag_opening?.value

    if (!tagOpening) return
    if (tagOpening.startsWith("<%%")) return

    const helperName = node.element_source.includes("#")
      ? node.element_source.split("#").pop()
      : node.element_source

    this.addOffense(
      `Avoid using \`${tagOpening} %>\` with \`${helperName}\`. Use \`<%= %>\` to ensure the helper's output is rendered.`,
      node.open_tag.location,
    )
  }
}

export class ActionViewNoSilentHelperRule extends ParserRule {
  static ruleName = "actionview-no-silent-helper"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      track_whitespace: true,
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ActionViewNoSilentHelperVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
