import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor, ElementStackVisitor, findParent } from "./rule-utils.js"
import { getTagName, getOpenTag, isHTMLOpenTagNode, isHTMLElementNode } from "@herb-tools/core"

import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLCloseTagNode, ParseResult, XMLDeclarationNode, Node } from "@herb-tools/core"

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

class TagNameLowercaseVisitor extends ElementStackVisitor<TagNameAutofixContext> {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode) {
    if (!this.isInsideElement("svg") || this.currentTagName === "svg") {
      this.checkTagName(node)
    }

    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode) {
    if (!this.isInsideElement("svg") || this.currentTagName === "svg") {
      this.checkTagName(node)
    }

    super.visitHTMLCloseTagNode(node)
  }

  private checkTagName(node: HTMLOpenTagNode | HTMLCloseTagNode): void {
    const tagName = getTagName(node)

    if (!tagName) return

    const lowercaseTagName = tagName.toLowerCase()

    const type = isHTMLOpenTagNode(node) ? "Opening" : "Closing"
    const open = isHTMLOpenTagNode(node) ? "<" : "</"

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
  static ruleName = "html-tag-name-lowercase"
  static introducedIn = this.version("0.4.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      exclude: ["**/*.xml", "**/*.xml.erb"]
    }
  }

  isEnabled(result: ParseResult, _context?: Partial<LintContext>): boolean {
    const checker = new XMLDeclarationChecker(this.ruleName)

    checker.visit(result.value)

    return !checker.hasXMLDeclaration
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<TagNameAutofixContext>[] {
    const visitor = new TagNameLowercaseVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<TagNameAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, correctedTagName } = offense.autofixContext
    if (!node.tag_name) return null

    node.tag_name.value = correctedTagName

    const parentElement = findParent(result.value, node as any as Node)
    if (!parentElement || !isHTMLElementNode(parentElement)) return result

    switch (node.type) {
      case "AST_HTML_OPEN_TAG_NODE":
        if (!parentElement.close_tag) break

        const closeTag = parentElement.close_tag as Mutable<HTMLCloseTagNode>
        closeTag.tag_name!.value = correctedTagName
        break
      case "AST_HTML_CLOSE_TAG_NODE":
        const openTag = getOpenTag(parentElement) as Mutable<HTMLOpenTagNode> | null
        if (openTag?.tag_name) {
          openTag.tag_name.value = correctedTagName
        }
        break
      default:
        break
    }

    return result
  }
}
