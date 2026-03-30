import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule, BaseAutofixContext } from "../types.js"
import { ERBStringToDirectOutputRewriter } from "@herb-tools/rewriter"

import { locationFromOffset } from "./rule-utils.js"
import { isERBOutputNode, createLiteral, createERBOutputNode, findParentArray } from "@herb-tools/core"

import type { Mutable, ReplacementPart } from "@herb-tools/rewriter"
import type { ParseResult, ERBContentNode, ParserOptions, Node } from "@herb-tools/core"
import type { UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"

interface PreferDirectOutputAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBContentNode>
  replacementParts: ReplacementPart[]
}

class PreferDirectOutputVisitor extends BaseRuleVisitor<PreferDirectOutputAutofixContext> {
  visitERBContentNode(node: ERBContentNode): void {
    if (!isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const content = node.content?.value?.trim() ?? ""

    if (!ERBStringToDirectOutputRewriter.isStringOutputNode(prismNode)) return

    const nodeType = prismNode.constructor.name
    const replacementParts = ERBStringToDirectOutputRewriter.extractReplacementParts(prismNode, source)

    const { startOffset, length } = prismNode.location
    const stringLocation = locationFromOffset(source, startOffset, length)

    const autofixContext = replacementParts
      ? { node: node as Mutable<ERBContentNode>, replacementParts }
      : undefined

    if (nodeType === "StringNode") {
      this.addOffense(
        `Avoid outputting string literal \`${content}\`. Write the text directly without wrapping it in an ERB output tag.`,
        stringLocation,
        autofixContext,
      )
    }

    if (nodeType === "InterpolatedStringNode") {
      this.addOffense(
        `Avoid outputting interpolated string \`${content}\`. Use separate \`<%= %>\` tags for each dynamic value instead.`,
        stringLocation,
        autofixContext,
      )
    }

    super.visitERBContentNode(node)
  }
}

export class ERBPreferDirectOutputRule extends ParserRule<PreferDirectOutputAutofixContext> {
  static ruleName = "erb-prefer-direct-output"
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

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<PreferDirectOutputAutofixContext>[] {
    const visitor = new PreferDirectOutputVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<PreferDirectOutputAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, replacementParts } = offense.autofixContext
    const erbNode = node as unknown as ERBContentNode
    const parentInfo = findParentArray(result.value, erbNode)

    if (!parentInfo) return null

    const tagOpening = erbNode.tag_opening?.value ?? "<%="
    const tagClosing = erbNode.tag_closing?.value ?? "%>"

    const { array: parentArray, index: nodeIndex } = parentInfo
    const replacementNodes: Node[] = []

    for (const part of replacementParts) {
      if (part.type === "text") {
        replacementNodes.push(createLiteral(part.content))
      } else {
        replacementNodes.push(createERBOutputNode(` ${part.expression.trim()} `, tagOpening, tagClosing))
      }
    }

    parentArray.splice(nodeIndex, 1, ...replacementNodes)

    return result
  }
}
