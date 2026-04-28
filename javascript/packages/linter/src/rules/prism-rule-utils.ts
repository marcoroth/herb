import { isPrismNodeType } from "@herb-tools/core"
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

    if (isPrismNodeType(receiver, "CallNode")) {
      return receiver.name === "binding" && !receiver.receiver
    }
  }

  return false
}

export function rootReceiver(node: PrismNode): PrismNode {
  let current = node

  while (current.receiver) {
    current = current.receiver
  }

  return current
}

export function isCallOnLocal(node: PrismNode, localNames: Set<string>): boolean {
  const root = rootReceiver(node)

  if (isPrismNodeType(root, "LocalVariableReadNode")) {
    return localNames.has(root.name)
  }

  if (isPrismNodeType(root, "CallNode") && !root.receiver) {
    return localNames.has(root.name)
  }

  return false
}

