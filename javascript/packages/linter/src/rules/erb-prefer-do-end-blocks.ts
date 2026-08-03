import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor, locationFromContentOffset } from "./rule-utils.js"
import { isAssignmentNode } from "./prism-rule-utils.js"

import { isPrismNodeType } from "@herb-tools/core"

import type { ERBBlockNode, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, LintOffense, UnboundLintOffense } from "../types.js"

interface PreferDoEndBlocksAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBBlockNode>
  braceOffset: number
}

function isBraceBlock(node: ERBBlockNode): boolean {
  return (node.end_node?.content?.value ?? "").trim().startsWith("}")
}

function braceOffset(node: ERBBlockNode): number | null {
  const offset = (node.content?.value ?? "").lastIndexOf("{")

  return offset === -1 ? null : offset
}

function blockBindsToSameCall(prismNode: PrismNode | null | undefined): boolean {
  let node = prismNode

  while (node && isAssignmentNode(node)) {
    node = node.value
  }

  if (!isPrismNodeType(node, "CallNode")) return false

  return isPrismNodeType(node.block, "BlockNode")
}

class PreferDoEndBlocksVisitor extends BaseRuleVisitor<PreferDoEndBlocksAutofixContext> {
  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkBlockDelimiters(node)

    this.visitChildNodes(node)
  }

  private checkBlockDelimiters(node: ERBBlockNode): void {
    if (!isBraceBlock(node)) return

    const content = node.content
    const offset = braceOffset(node)

    if (!content || offset === null) return

    const location = locationFromContentOffset(content.location.start.line, content.location.start.column, content.value, offset)

    const autofixContext = blockBindsToSameCall(node.prismNode)
      ? { node: node as Mutable<ERBBlockNode>, braceOffset: offset }
      : undefined

    this.addOffense(
      "Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.",
      location,
      autofixContext,
    )
  }
}

export class ERBPreferDoEndBlocksRule extends ParserRule<PreferDoEndBlocksAutofixContext> {
  static ruleName = "erb-prefer-do-end-blocks"
  static introducedIn = this.version("unreleased")
  static autocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<PreferDoEndBlocksAutofixContext>[] {
    const visitor = new PreferDoEndBlocksVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<PreferDoEndBlocksAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, braceOffset } = offense.autofixContext

    const content = node.content
    const endContent = node.end_node?.content

    if (!content || !endContent) return null

    const closingOffset = endContent.value.indexOf("}")

    if (content.value[braceOffset] !== "{") return null
    if (closingOffset === -1) return null

    const afterBrace = content.value.slice(braceOffset + 1)
    const keyword = afterBrace.startsWith("|") ? "do " : "do"

    content.value = content.value.slice(0, braceOffset) + keyword + afterBrace
    endContent.value = endContent.value.slice(0, closingOffset) + "end" + endContent.value.slice(closingOffset + 1)

    return result
  }
}
