import { Visitor } from "@herb-tools/core"

import type { ERBRenderNode } from "@herb-tools/core"

export class RenderCollector extends Visitor {
  public readonly renders: ERBRenderNode[] = []

  visitERBRenderNode(node: ERBRenderNode): void {
    this.renders.push(node)

    this.visitChildNodes(node)
  }
}
