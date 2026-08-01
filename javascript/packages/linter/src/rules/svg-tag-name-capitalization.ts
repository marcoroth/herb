import { ParserRule } from "../types.js"
import { ElementStackVisitor, SVG_CAMEL_CASE_ELEMENTS, SVG_LOWERCASE_TO_CAMELCASE } from "./rule-utils.js"

import type { UnboundLintOffense, LintOffense, LintContext, BaseAutofixContext, Mutable, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLCloseTagNode, ERBOpenTagNode, Token, ParseResult, ParserOptions } from "@herb-tools/core"

type HTMLTagNode = HTMLOpenTagNode | HTMLCloseTagNode

interface SVGTagNameCapitalizationAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLTagNode>
  currentTagName: string
  correctCamelCase: string
}

class SVGTagNameCapitalizationVisitor extends ElementStackVisitor<SVGTagNameCapitalizationAutofixContext> {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTagName(node.tag_name, "Opening", node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLCloseTagNode(node: HTMLCloseTagNode): void {
    this.checkTagName(node.tag_name, "Closing", node)
    super.visitHTMLCloseTagNode(node)
  }

  visitERBOpenTagNode(node: ERBOpenTagNode): void {
    this.checkTagName(node.tag_name, "ERB opening")
    super.visitERBOpenTagNode(node)
  }

  private checkTagName(tagNameToken: Token | null, type: string, autofixNode?: HTMLTagNode): void {
    if (!this.isInsideElement("svg")) return

    const tagName = tagNameToken?.value
    if (!tagName) return

    if (SVG_CAMEL_CASE_ELEMENTS.has(tagName)) return

    const correctCamelCase = SVG_LOWERCASE_TO_CAMELCASE.get(tagName.toLowerCase())
    if (!correctCamelCase || tagName === correctCamelCase) return

    this.addOffense(
      `${type} SVG tag name \`${tagName}\` should use proper capitalization. Use \`${correctCamelCase}\` instead.`,
      tagNameToken!.location,
      autofixNode ? { node: autofixNode, currentTagName: tagName, correctCamelCase } : undefined
    )
  }
}

export class SVGTagNameCapitalizationRule extends ParserRule<SVGTagNameCapitalizationAutofixContext> {
  static autocorrectable = true
  static ruleName = "svg-tag-name-capitalization"
  static introducedIn = this.version("0.4.2")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<SVGTagNameCapitalizationAutofixContext>[] {
    const visitor = new SVGTagNameCapitalizationVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<SVGTagNameCapitalizationAutofixContext>, result: ParseResult, _context?: Partial<LintContext>): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node: { tag_name }, correctCamelCase } = offense.autofixContext

    if (!tag_name) return null

    tag_name.value = correctCamelCase

    return result
  }
}
