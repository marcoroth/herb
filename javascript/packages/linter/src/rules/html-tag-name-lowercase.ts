import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isNode, getTagName, HTMLOpenTagNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLElementNode, HTMLCloseTagNode, ParseResult, XMLDeclarationNode, Node } from "@herb-tools/core"

interface TagNameAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLOpenTagNode | HTMLCloseTagNode>
  tagName: string
  correctedTagName: string
}

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

class TagNameLowercaseVisitor extends BaseRuleVisitor<TagNameAutofixContext> {
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

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode | null): void {
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
        {
          node,
          tagName,
          correctedTagName: lowercaseTagName
        }
      )
    }
  }
}

export class HTMLTagNameLowercaseRule extends ParserRule<TagNameAutofixContext> {
  static autocorrectable = true
  name = "html-tag-name-lowercase"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  isEnabled(result: ParseResult, _context?: Partial<LintContext>): boolean {
    const checker = new XMLDeclarationChecker(this.name)

    checker.visit(result.value)

    return !checker.hasXMLDeclaration
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<TagNameAutofixContext>[] {
    const visitor = new TagNameLowercaseVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<TagNameAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node: { tag_name }, correctedTagName } = offense.autofixContext

    if (!tag_name) return null

    tag_name.value = correctedTagName

    return result
  }
}
