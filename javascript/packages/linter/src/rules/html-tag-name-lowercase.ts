import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isNode, getTagName, HTMLElementNode, HTMLOpenTagNode, HTMLCloseTagNode, ParseResult, XMLDeclarationNode, Node } from "@herb-tools/core"

import type { LintOffense, LintContext } from "../types.js"

class XMLDeclarationChecker extends BaseRuleVisitor {
  hasXMLDeclaration: boolean = false

  visitXMLDeclarationNode(_node: XMLDeclarationNode): void {
    this.hasXMLDeclaration = true
  }

  visitChildNodes(node: Node): void {
    if (this.hasXMLDeclaration) return
    super.visitChildNodes(node)
  }
}

class TagNameLowercaseVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagName(node).toLowerCase() === "svg") {
      this.checkTagName(node.open_tag)
      this.checkTagName(node.close_tag)
    } else {
      super.visitHTMLElementNode(node)
    }
  }

  visitHTMLOpenTagNode(node: HTMLOpenTagNode) {
    this.checkTagName(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode) {
    this.checkTagName(node)
  }

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode | null): void {
    if (!node) return

    const tagName = getTagName(node)

    if (!tagName) return

    const lowercaseTagName = tagName.toLowerCase()

    const type = isNode(node, HTMLOpenTagNode) ? "Opening" : "Closing"
    const open = isNode(node, HTMLOpenTagNode) ? "<" : "</"

    if (tagName !== lowercaseTagName) {
      this.addOffense(
        `${type} tag name \`${open}${tagName}>\` should be lowercase. Use \`${open}${lowercaseTagName}>\` instead.`,
        node.tag_name!.location,
        "error"
      )
    }
  }
}

export class HTMLTagNameLowercaseRule extends ParserRule {
  name = "html-tag-name-lowercase"

  isEnabled(result: ParseResult, context?: Partial<LintContext>): boolean {
    if (context?.fileName?.endsWith(".xml") || context?.fileName?.endsWith(".xml.erb")) {
      return false
    }

    const checker = new XMLDeclarationChecker(this.name)
    checker.visit(result.value)
    return !checker.hasXMLDeclaration
  }

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new TagNameLowercaseVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
