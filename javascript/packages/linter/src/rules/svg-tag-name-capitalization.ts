import { BaseRuleVisitor, SVG_CAMEL_CASE_ELEMENTS, SVG_LOWERCASE_TO_CAMELCASE } from "./rule-utils.js"

import { ParserRule } from "../types.js"
import type { LintOffense, LintContext } from "../types.js"
import type { HTMLElementNode, HTMLOpenTagNode, HTMLCloseTagNode, ParseResult } from "@herb-tools/core"

class SVGTagNameCapitalizationVisitor extends BaseRuleVisitor {
  private insideSVG = false

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = node.tag_name?.value

    if (tagName && ["svg"].includes(tagName.toLowerCase())) {
      const wasInsideSVG = this.insideSVG
      this.insideSVG = true
      this.visitChildNodes(node)
      this.insideSVG = wasInsideSVG
      return
    }

    if (this.insideSVG) {
      if (node.open_tag) {
        this.checkTagName(node.open_tag as HTMLOpenTagNode)
      }
      if (node.close_tag) {
        this.checkTagName(node.close_tag as HTMLCloseTagNode)
      }
    }

    this.visitChildNodes(node)
  }


  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode): void {
    const tagName = node.tag_name?.value

    if (!tagName) return

    if (SVG_CAMEL_CASE_ELEMENTS.has(tagName)) return

    const lowercaseTagName = tagName.toLowerCase()
    const correctCamelCase = SVG_LOWERCASE_TO_CAMELCASE.get(lowercaseTagName)

    if (correctCamelCase && tagName !== correctCamelCase) {
      let type: string = node.type

      if (node.type == "AST_HTML_OPEN_TAG_NODE") type = "Opening"
      if (node.type == "AST_HTML_CLOSE_TAG_NODE") type = "Closing"

      this.addOffense(
        `${type} SVG tag name \`${tagName}\` should use proper capitalization. Use \`${correctCamelCase}\` instead.`,
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class SVGTagNameCapitalizationRule extends ParserRule {
  name = "svg-tag-name-capitalization"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new SVGTagNameCapitalizationVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
