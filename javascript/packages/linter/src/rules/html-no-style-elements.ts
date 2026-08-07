import { getTagLocalName } from "@herb-tools/core"
import type { ParseResult, ParserOptions, HTMLElementNode } from "@herb-tools/core"

import { BaseRuleVisitor } from "./rule-utils.js"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import { ParserRule } from "../types.js"

class HTMLNoStyleElementsVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "style") {
      this.addOffense(
        `Avoid inline \`<style>\` tags. ${this.suggestion()}`,
        node.open_tag!.location,
      )
    }

    super.visitHTMLElementNode(node)
  }

  private suggestion(): string {
    if (this.context.framework === "actionview") {
      return "Extract the CSS into a separate `.css` file and include it with `stylesheet_link_tag`."
    }

    return "Extract the CSS into a separate `.css` file and deliver it through your framework's asset pipeline."
  }
}

export class HTMLNoStyleElementsRule extends ParserRule {
  static ruleName = "html-no-style-elements"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLNoStyleElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
