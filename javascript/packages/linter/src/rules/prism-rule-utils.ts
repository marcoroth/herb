import type { PrismNode } from "@herb-tools/core"

export function isAssignmentNode(prismNode: PrismNode): boolean {
  const type: string = prismNode?.constructor?.name
  if (!type) return false

  return type.endsWith("WriteNode")
}
