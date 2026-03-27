import { ParserRule } from "../types.js"
import { BaseRuleVisitor, isBodyOnlyTag } from "./rule-utils.js"
import { getTagLocalName } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, ParseResult } from "@herb-tools/core"

class HTMLBodyOnlyElementsVisitor extends BaseRuleVisitor {
  private elementStack: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagLocalName(node)
    if (!tagName) return

    this.checkBodyOnlyElement(node, tagName)

    this.elementStack.push(tagName)
    this.visitChildNodes(node)
    this.elementStack.pop()
  }

  private checkBodyOnlyElement(node: HTMLElementNode, tagName: string): void {
    if (this.insideBody) return
    if (!this.insideHead) return
    if (!isBodyOnlyTag(tagName)) return

    this.addOffense(
      `Element \`<${tagName}>\` must be placed inside the \`<body>\` tag.`,
      node.location,
    )
  }

  private get insideBody(): boolean {
    return this.elementStack.includes("body")
  }

  private get insideHead(): boolean {
    return this.elementStack.includes("head")
  }
}

export class HTMLBodyOnlyElementsRule extends ParserRule {
  static autocorrectable = false
  static ruleName = "html-body-only-elements"
  static introducedIn = this.version("0.8.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLBodyOnlyElementsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
