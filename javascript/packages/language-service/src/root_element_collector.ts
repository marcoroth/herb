import { Visitor } from "@herb-tools/core"

import type { HTMLElementNode } from "@herb-tools/core"

export class RootElementCollector extends Visitor {
  element: HTMLElementNode | null = null

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (this.element) return

    this.element = node
  }
}
