import { Visitor, isRubyParameterNode } from "@herb-tools/core"

import type { ERBStrictLocalsNode } from "@herb-tools/core"

const STRICT_LOCAL_KIND = "keyword"

export class StrictLocalsCollector extends Visitor {
  readonly names = new Set<string>()
  declared = false

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.declared = true

    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue
      if (local.kind !== STRICT_LOCAL_KIND) continue

      const name = local.name?.value

      if (name) {
        this.names.add(name)
      }
    }
  }
}
