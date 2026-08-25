import { Visitor, isRubyParameterNode } from "@herb-tools/core"

import type { ERBStrictLocalsNode, SerializedLocation } from "@herb-tools/core"

const STRICT_LOCAL_KIND = "keyword"

export interface StrictLocalDeclaration {
  name: string
  location: SerializedLocation
}

export class StrictLocalsCollector extends Visitor {
  readonly names = new Set<string>()
  readonly declarations: StrictLocalDeclaration[] = []
  public declared = false

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.declared = true

    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue
      if (local.kind !== STRICT_LOCAL_KIND) continue

      const name = local.name?.value
      const location = local.name?.location

      if (name) {
        this.names.add(name)

        if (location) this.declarations.push({ name, location })
      }
    }
  }
}
