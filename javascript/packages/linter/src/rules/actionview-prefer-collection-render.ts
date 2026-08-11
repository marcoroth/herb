import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { isERBOutputNode, isNode, HTMLTextNode } from "@herb-tools/core"

import type { ERBIterationBlockNode, ERBRenderNode, Node, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

class PreferCollectionRenderVisitor extends BaseRuleVisitor {
  visitERBIterationBlockNode(node: ERBIterationBlockNode): void {
    this.checkIterationBlock(node)

    this.visitChildNodes(node)
  }

  private checkIterationBlock(node: ERBIterationBlockNode): void {
    if (node.message?.value !== "each") return

    const receiver = node.receiver?.value
    if (!receiver) return

    const blockArgument = this.singleBlockArgumentName(node)
    if (!blockArgument) return

    const render = this.singleRenderNodeInBody(node)
    if (!render) return

    const suggestion = this.collectionRenderFor(render, receiver, blockArgument)
    if (!suggestion) return

    this.addOffense(
      `Prefer \`${suggestion}\` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.`,
      node.location,
    )
  }

  private singleBlockArgumentName(node: ERBIterationBlockNode): string | null {
    if (node.block_arguments.length !== 1) return null

    const argument = node.block_arguments[0] as { kind?: string; name?: { value?: string } }

    if (argument.kind !== "positional") return null

    return argument.name?.value ?? null
  }

  private singleRenderNodeInBody(node: ERBIterationBlockNode): ERBRenderNode | null {
    const body = node.body.filter(child => !this.isWhitespaceOnlyText(child))

    if (body.length !== 1) return null

    const [child] = body

    if (child.type !== "AST_ERB_RENDER_NODE") return null

    const render = child as ERBRenderNode

    return isERBOutputNode(render) ? render : null
  }

  private isWhitespaceOnlyText(node: Node): boolean {
    return isNode(node, HTMLTextNode) && node.content.trim() === ""
  }

  private collectionRenderFor(render: ERBRenderNode, receiver: string, blockArgument: string): string | null {
    const keywords = render.keywords

    if (!keywords) return null
    if (keywords.object?.value === blockArgument) return `<%= render ${receiver} %>`

    const partial = keywords.partial?.value
    if (!partial) return null

    const locals = keywords.locals ?? []
    if (locals.length !== 1) return null

    const [local] = locals as Array<{ name?: { value?: string }, value?: { content?: string } }>
    if (local.value?.content !== blockArgument) return null

    const localName = local.name?.value
    if (!localName) return null

    const as = localName === this.collectionLocalNameFor(partial) ? "" : `, as: :${localName}`

    return `<%= render partial: "${partial}", collection: ${receiver}${as} %>`
  }

  private collectionLocalNameFor(partial: string): string {
    const name = partial.split("/").pop() ?? partial

    return name.startsWith("_") ? name.slice(1) : name
  }
}

export class ActionViewPreferCollectionRenderRule extends ParserRule {
  static ruleName = "actionview-prefer-collection-render"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      iteration_nodes: true,
      render_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new PreferCollectionRenderVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
