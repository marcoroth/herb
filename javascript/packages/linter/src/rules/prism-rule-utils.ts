import type { PrismNode } from "@herb-tools/core"

export const DEBUG_OUTPUT_METHODS = new Set(["p", "pp", "puts", "print", "warn", "debug", "byebug"])
export const BINDING_DEBUGGER_METHODS = new Set(["pry", "irb"])

export function isAssignmentNode(prismNode: PrismNode): boolean {
  const type: string = prismNode?.constructor?.name
  if (!type) return false

  return type.endsWith("WriteNode")
}

export function isDebugOutputCall(node: PrismNode): boolean {
  if (!node.receiver && DEBUG_OUTPUT_METHODS.has(node.name)) return true

  if (BINDING_DEBUGGER_METHODS.has(node.name)) {
    const receiver = node.receiver

    if (receiver?.constructor?.name === "CallNode") {
      return receiver.name === "binding" && !receiver.receiver
    }
  }

  return false
}
