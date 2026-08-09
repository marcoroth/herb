import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { ERBStringToDirectOutputRewriter } from "@herb-tools/rewriter"

import { isERBOutputNode, isPrismNodeType, createLiteral, findParentArray, locationFromByteOffset, substringFromByteOffset } from "@herb-tools/core"

import type { ParseResult, ERBContentNode, ParserOptions, PrismNode, Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

interface UnnecessaryHTMLSafeAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBContentNode>
  content: string
}

function stringLiteralReceiver(prismNode: PrismNode): PrismNode | null {
  if (!isPrismNodeType(prismNode, "CallNode")) return null
  if (prismNode.name !== "html_safe") return null
  if (prismNode.block) return null
  if (prismNode.arguments_) return null

  const receiver = prismNode.receiver

  if (!receiver) return null
  if (!isPrismNodeType(receiver, "StringNode")) return null

  return receiver
}

class ActionViewNoUnnecessaryHTMLSafeVisitor extends BaseRuleVisitor<UnnecessaryHTMLSafeAutofixContext> {
  visitERBContentNode(node: ERBContentNode): void {
    this.checkUnnecessaryHTMLSafe(node)

    super.visitERBContentNode(node)
  }

  private checkUnnecessaryHTMLSafe(node: ERBContentNode): void {
    if (!isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const receiver = stringLiteralReceiver(prismNode)
    if (!receiver) return

    const { startOffset, length } = prismNode.location
    const literal = substringFromByteOffset(source, receiver.location.startOffset, receiver.location.length)
    const content = ERBStringToDirectOutputRewriter.extractStringContent(receiver, source)

    const autofixContext = content.includes("<%")
      ? undefined
      : { node: node as Mutable<ERBContentNode>, content }

    this.addOffense(
      `Avoid calling \`.html_safe\` on the String literal \`${literal}\`. Write the content directly in the template instead.`,
      locationFromByteOffset(source, startOffset, length),
      autofixContext,
      undefined,
      ["unnecessary"],
    )
  }
}

export class ActionViewNoUnnecessaryHTMLSafeRule extends ParserRule<UnnecessaryHTMLSafeAutofixContext> {
  static ruleName = "actionview-no-unnecessary-html-safe"
  static introducedIn = this.version("unreleased")
  static autocorrectable = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<UnnecessaryHTMLSafeAutofixContext>[] {
    const visitor = new ActionViewNoUnnecessaryHTMLSafeVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<UnnecessaryHTMLSafeAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, content } = offense.autofixContext
    const erbNode = node as unknown as ERBContentNode
    const parentInfo = findParentArray(result.value, erbNode)

    if (!parentInfo) return null

    const { array: parentArray, index: nodeIndex } = parentInfo
    const replacementNodes: Node[] = [createLiteral(content)]

    parentArray.splice(nodeIndex, 1, ...replacementNodes)

    return result
  }
}
