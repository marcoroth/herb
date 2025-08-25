import { ParserRule } from "../types.js"
import { BaseRuleVisitor, isVoidElement } from "./rule-utils.js"
import { getTagName } from "@herb-tools/core"

import type { LintContext, LintOffense } from "../types.js"
import type { HTMLOpenTagNode, HTMLElementNode, ParseResult } from "@herb-tools/core"

class NoSelfClosingVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagName(node) === "svg") {
      this.visit(node.open_tag)
    } else {
      this.visitChildNodes(node)
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.tag_closing?.value === "/>") {
      const tagName = getTagName(node)
      const instead = isVoidElement(tagName) ? `<${tagName}>` : `<${tagName}></${tagName}>`

      this.addOffense(
        `Use \`${instead}\` instead of self-closing \`<${tagName} />\` for HTML compatibility.`,
        node.location,
        "error"
      )
    }
  }
}

export class HTMLNoSelfClosingRule extends ParserRule {
  name = "html-no-self-closing"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new NoSelfClosingVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
