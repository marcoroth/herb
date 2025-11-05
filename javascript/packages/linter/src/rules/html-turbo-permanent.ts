import { BaseRuleVisitor, getTagName, hasAttribute, getAttributeValue, findAttributeByName, getAttributes } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core"

class HTMLTurboPermanentVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTurboPermanentAttribute(node)
    super.visitHTMLOpenTagNode(node)
  }

  private checkTurboPermanentAttribute(node: HTMLOpenTagNode): void {
    const attribute = findAttributeByName(getAttributes(node), "data-turbo-permanent")
    if (!attribute) return

    if (getAttributeValue(attribute) === "true") {
      this.addOffense(
        'Attribute `data-turbo-permanent` should not contain value "false"',
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLTurboPermanentRule extends ParserRule {
  name = "html-turbo-permanent"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new HTMLTurboPermanentVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
