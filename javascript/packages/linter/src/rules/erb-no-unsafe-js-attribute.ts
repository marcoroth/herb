import { ParserRule } from "../types.js"
import { AttributeVisitorMixin } from "./rule-utils.js"
import { isERBNode, isERBOutputNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, Node } from "@herb-tools/core"
import type { StaticAttributeDynamicValueParams } from "./rule-utils.js"

const JS_ATTRIBUTE_PATTERN = /^on/i
const SAFE_PATTERN = /\.to_json\s*$|\bj\s*[\s(]|\bescape_javascript\s*[\s(]/

class ERBNoUnsafeJSAttributeVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeDynamicValue({ attributeName, valueNodes }: StaticAttributeDynamicValueParams): void {
    if (!JS_ATTRIBUTE_PATTERN.test(attributeName)) return

    for (const node of valueNodes) {
      if (!isERBNode(node)) continue
      if (!isERBOutputNode(node)) continue

      const content = node.content?.value?.trim() || ""

      if (SAFE_PATTERN.test(content)) continue

      this.addOffense(
        `Unsafe ERB output in \`${attributeName}\` attribute. Use \`.to_json\`, \`j()\`, or \`escape_javascript()\` to safely encode values.`,
        node.location,
      )
    }
  }
}

export class ERBNoUnsafeJSAttributeRule extends ParserRule {
  static ruleName = "erb-no-unsafe-js-attribute"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ERBNoUnsafeJSAttributeVisitor(this.ruleName, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
