import { getTagName, hasAttribute, getAttributeValue, findAttributeByName, getAttributes } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { Visitor } from "@herb-tools/core"

import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"
import type { LintContext, LintOffense } from "../types.js"

class HTMLTurboPermanentVisitor extends Visitor {
  public readonly offenses: LintOffense[] = []
  private ruleName: string

  constructor(ruleName: string) {
    super()
    this.ruleName = ruleName
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTurboPermanentAttribute(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkTurboPermanentAttribute(node: HTMLOpenTagNode): void {
    const attribute = findAttributeByName(getAttributes(node), "data-turbo-permanent")
    if (!attribute) return

    if (getAttributeValue(attribute) !== null) {
      this.offenses.push({
        rule: this.ruleName,
        code: this.ruleName,
        source: "Turbo Linter",
        message: 'Attribute `data-turbo-permanent` should not contain any value',
        location: node.tag_name!.location,
        severity: "error"
      })
    }
  }
}

export class HtmlTurboPermanentRule extends ParserRule {
  name = "html-turbo-permanent"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLTurboPermanentVisitor(this.name)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
