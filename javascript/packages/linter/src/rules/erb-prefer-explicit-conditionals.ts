import { ParserRule, BaseAutofixContext } from "../types.js"
import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { IdentityPrinter } from "@herb-tools/printer"

import { findParentArray, isERBContentNode, isERBIfNode, isHTMLTextNode, isLiteralNode } from "@herb-tools/core"

import type { Mutable } from "@herb-tools/rewriter"
import type { ERBContentNode, ERBIfNode, ERBUnlessNode, Node, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, LintOffense, UnboundLintOffense } from "../types.js"

interface PreferExplicitConditionalsAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBIfNode> | Mutable<ERBUnlessNode>
  replacement: ERBIfNode | ERBUnlessNode
}

function isSynthesizedConditional(node: ERBIfNode | ERBUnlessNode): boolean {
  const opening = node.tag_opening

  if (!opening) return false

  const { start, end } = opening.location

  return start.line === end.line && start.column === end.column
}

function isInlineConditional(node: ERBIfNode | ERBUnlessNode): boolean {
  if (!isSynthesizedConditional(node)) return false
  if (isERBIfNode(node) && node.subsequent !== null) return false

  return true
}

function isAutofixable(node: ERBIfNode | ERBUnlessNode): boolean {
  if (node.statements.length > 1) return false

  const [body] = node.statements

  if (body === undefined) return true

  return isERBContentNode(body) || isLiteralNode(body) || isHTMLTextNode(body)
}

class PreferExplicitConditionalsVisitor extends BaseRuleVisitor<PreferExplicitConditionalsAutofixContext> {
  visitERBIfNode(node: ERBIfNode): void {
    this.checkInlineConditional(node, "if")

    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    this.checkInlineConditional(node, "unless")

    this.visitChildNodes(node)
  }

  private checkInlineConditional(node: ERBIfNode | ERBUnlessNode, keyword: string): void {
    if (!isInlineConditional(node)) return

    const suggestion = IdentityPrinter.print(node).replace(/\s*\n\s*/g, " ")

    const autofixContext = isAutofixable(node)
      ? { node: node as Mutable<ERBIfNode | ERBUnlessNode>, nodeType: "AST_ERB_CONTENT_NODE", replacement: node }
      : undefined

    this.addOffense(
      `Prefer an explicit \`<% ${keyword} %>\` block over an inline \`${keyword}\` condition. Use \`${suggestion}\` instead.`,
      node.location,
      autofixContext,
    )
  }
}

export class ERBPreferExplicitConditionalsRule extends ParserRule<PreferExplicitConditionalsAutofixContext> {
  static ruleName = "erb-prefer-explicit-conditionals"
  static introducedIn = this.version("unreleased")
  static autocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      transform_conditionals: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<PreferExplicitConditionalsAutofixContext>[] {
    const visitor = new PreferExplicitConditionalsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<PreferExplicitConditionalsAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, replacement } = offense.autofixContext
    const original = node as unknown as ERBContentNode

    if (!isERBContentNode(original)) return null
    if (original.tag_closing?.value !== "%>") return null

    const parentInfo = findParentArray(result.value, original)

    if (!parentInfo) return null

    parentInfo.array.splice(parentInfo.index, 1, replacement as unknown as Node)

    return result
  }
}
