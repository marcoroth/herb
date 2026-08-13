import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { ERBEndNode, ERBOpenTagNode, HTMLVirtualCloseTagNode, Token, getAttribute, getAttributeName, getTagLocalName, isERBContentNode, isERBOutputNode, isHTMLAttributeNode, isHTMLOpenTagNode, isHTMLTextNode, isLiteralNode, isPrismNodeType, isWhitespaceNode } from "@herb-tools/core"

import { HELPER_REGISTRY } from "@herb-tools/core"

import { serializeTagHelperAttributes } from "@herb-tools/rewriter"

import type { ERBContentNode, HTMLAttributeValueNode, HTMLElementNode, HTMLOpenTagNode, Node, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { BaseAutofixContext, Mutable, UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

const NON_EMBEDDABLE_PRISM_TYPES = ["IfNode", "UnlessNode", "WhileNode", "UntilNode", "CaseNode", "CaseMatchNode", "RescueModifierNode", "BeginNode", "ReturnNode", "BreakNode", "NextNode", "StatementsNode", "ProgramNode"] as const
const UNQUOTABLE_IN_RUBY_STRING = /["\\#&]/
const RUBY_LABEL = /^[a-z_][a-z0-9_]*$/
const PREFIXED_ATTRIBUTE_NAME = /^(data|aria)-(.+)$/
const WHITESPACE_RUN = /\s+/g

interface PreferLinkToHelperAutofixContext extends BaseAutofixContext {
  node: HTMLElementNode
  content: string
  inline: boolean
}

function collapseWhitespace(value: string): string {
  return value.replace(WHITESPACE_RUN, " ").trim()
}

function needsParentheses(prismNode: PrismNode): boolean {
  if (!isPrismNodeType(prismNode, "CallNode")) return false
  if (!prismNode.arguments_ || prismNode.openingLoc) return false

  return !prismNode.receiver || Boolean(prismNode.callOperatorLoc)
}

function embeddableSource(node: ERBContentNode): string | null {
  const prismNode = node.prismNode
  if (!prismNode) return null

  if (NON_EMBEDDABLE_PRISM_TYPES.some(type => isPrismNodeType(prismNode, type))) return null

  const expression = collapseWhitespace(node.content?.value ?? "")
  if (expression === "") return null

  return needsParentheses(prismNode) ? `(${expression})` : expression
}

function singleOutputNode(children: Node[]): ERBContentNode | null {
  if (children.length !== 1) return null

  const [child] = children

  if (!isERBContentNode(child)) return null
  if (!isERBOutputNode(child)) return null

  return child
}

function renderedChildren(node: HTMLElementNode): Node[] {
  return node.body.filter(child => !(isHTMLTextNode(child) && child.content.trim() === ""))
}

function linkTextArgument(node: HTMLElementNode): string | null {
  const children = renderedChildren(node)
  if (children.length !== 1) return null

  const [child] = children

  if (isHTMLTextNode(child)) {
    const text = collapseWhitespace(child.content)
    if (text === "") return null

    if (UNQUOTABLE_IN_RUBY_STRING.test(text)) return null

    return `"${text}"`
  }

  if (isERBContentNode(child) && isERBOutputNode(child)) {
    return embeddableSource(child)
  }

  return null
}

function serializeLinkOptions(openTag: HTMLOpenTagNode): string | null {
  const attributes = openTag.children.filter(child => !isWhitespaceNode(child))
  const serialized = serializeTagHelperAttributes(attributes, { extractHref: true })

  return serialized ? serialized.attributes : null
}

class ActionViewPreferLinkToHelperVisitor extends BaseRuleVisitor<PreferLinkToHelperAutofixContext> {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkAnchor(node)

    super.visitHTMLElementNode(node)
  }

  private checkAnchor(node: HTMLElementNode): void {
    if (getTagLocalName(node) !== "a") return

    const openTag = node.open_tag

    if (!isHTMLOpenTagNode(openTag)) return

    const href = getAttribute(node, "href")
    const output = href?.value ? singleOutputNode(href.value.children ?? []) : null

    if (!href || !output) return

    const url = embeddableSource(output)
    if (!url) return

    const text = linkTextArgument(node)
    const options = serializeLinkOptions(openTag)
    const inline = text !== null
    const args = inline ? [text, url] : [url]

    if (options) args.push(options)

    const content = inline ? `link_to ${args.join(", ")}` : `link_to ${args.join(", ")} do`
    const moves = [...(inline ? [] : ["the link's content in the block"]), ...(options === null ? ["the remaining attributes as options"] : [])]
    const advice = moves.length === 0 ? `Write \`<%= ${content} %>\` instead` : `Write \`<%= ${content} %>\` with ${moves.join(" and ")} instead`

    this.addOffense(
      `Prefer the \`link_to\` helper over a manual \`<a>\` tag with an ERB \`href\`. ${advice}, which is the Action View API for links and keeps the URL and the link's attributes in one Ruby call.`,
      href.location,
      this.autofixContextFor(node, content, inline, options),
    )
  }

  private autofixContextFor(node: HTMLElementNode, content: string, inline: boolean, options: string | null): PreferLinkToHelperAutofixContext | undefined {
    if (options === null) return undefined
    if (!inline && !node.close_tag) return undefined

    return { node, content, inline }
  }
}

export class ActionViewPreferLinkToHelperRule extends ParserRule<PreferLinkToHelperAutofixContext> {
  static ruleName = "actionview-prefer-link-to-helper"
  static introducedIn = this.version("unreleased")
  static autocorrectable = true
  static autofixRequiresContext = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
      frameworks: ["actionview"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<PreferLinkToHelperAutofixContext>[] {
    const visitor = new ActionViewPreferLinkToHelperVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<PreferLinkToHelperAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, content, inline } = offense.autofixContext
    const openTag = node.open_tag
    const closeTag = node.close_tag

    if (!openTag) return null
    if (!inline && !closeTag) return null

    const element = node as Mutable<HTMLElementNode>

    element.open_tag = ERBOpenTagNode.build({
      location: openTag.location,
      tag_opening: Token.from("TOKEN_ERB_START", "<%="),
      content: Token.from("TOKEN_ERB_CONTENT", ` ${content} `),
      tag_closing: Token.from("TOKEN_ERB_END", "%>"),
      tag_name: Token.from("TOKEN_IDENTIFIER", "a"),
    })

    element.element_source = HELPER_REGISTRY["link_to"].source

    if (inline) {
      element.body = []
      element.close_tag = HTMLVirtualCloseTagNode.build({ tag_name: Token.from("TOKEN_IDENTIFIER", "a") })
    } else {
      element.close_tag = ERBEndNode.build({
        location: closeTag!.location,
        tag_opening: Token.from("TOKEN_ERB_START", "<%"),
        content: Token.from("TOKEN_ERB_CONTENT", " end "),
        tag_closing: Token.from("TOKEN_ERB_END", "%>"),
      })
    }

    return result
  }
}
