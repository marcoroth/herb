import { Visitor, isERBRenderNode, isERBStrictLocalsNode, isRubyParameterNode, isRubyRenderLocalNode } from "@herb-tools/core"

import type { ERBRenderNode, ERBStrictLocalsNode, Node } from "@herb-tools/core"

export interface RenderCallDependency {
  partial: string
  locals: Record<string, string>
  collection?: string
}

export class RenderCallCollector extends Visitor {
  readonly renderCalls: RenderCallDependency[] = []
  readonly localsReceived: Record<string, string> = {}
  readonly localsDeclared = new Set<string>()

  override visitChildNodes(node: Node): void {
    if (isERBRenderNode(node)) this.collectRender(node)
    if (isERBStrictLocalsNode(node)) this.collectDeclared(node)

    super.visitChildNodes(node)
  }

  private collectRender(node: ERBRenderNode): void {
    const keywords = node.keywords
    if (!keywords) return

    const locals: Record<string, string> = {}

    for (const local of keywords.locals) {
      if (!isRubyRenderLocalNode(local)) continue

      const name = local.name?.value
      const raw = local.value?.content

      if (!name || raw === undefined || raw === null) continue

      const value = raw === `${name}:` ? name : String(raw)

      this.localsReceived[name] = value
      locals[name] = value
    }

    const partial = keywords.partial?.value
    if (!partial) return

    this.renderCalls.push({
      partial: String(partial).replace(/^["']|["']$/g, ""),
      locals,
      ...(keywords.collection?.value ? { collection: String(keywords.collection.value) } : {}),
    })
  }

  private collectDeclared(node: ERBStrictLocalsNode): void {
    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue

      const name = local.name?.value

      if (name) this.localsDeclared.add(name)
    }
  }
}
