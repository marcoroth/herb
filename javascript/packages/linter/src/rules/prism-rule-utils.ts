import { isPrismNodeType } from "@herb-tools/core"
import type { PrismNode } from "@herb-tools/core"

export const DEBUG_OUTPUT_METHODS = new Set(["p", "pp", "puts", "print", "warn", "debug", "byebug"])
export const BINDING_DEBUGGER_METHODS = new Set(["pry", "irb"])

export const SIDE_EFFECT_METHODS = new Set([
  "content_for",
  "provide",
  "flush",
  "turbo_refreshes_with",
  "turbo_exempts_page_from_cache",
  "turbo_exempts_page_from_preview",
  "turbo_page_requires_reload",
])

export const CONTROL_FLOW_METHODS = new Set(["raise", "throw", "fail"])

const CONTROL_FLOW_NODE_TYPES = ["BreakNode", "NextNode", "RedoNode", "RetryNode", "ReturnNode"]

export function isSideEffectCall(node: PrismNode): boolean {
  if (!isPrismNodeType(node, "CallNode")) return false
  if (node.receiver) return false

  return SIDE_EFFECT_METHODS.has(node.name)
}

export function isControlFlowNode(node: PrismNode): boolean {
  const type: string = node?.constructor?.name
  if (!type) return false

  if (CONTROL_FLOW_NODE_TYPES.includes(type)) return true

  if (isPrismNodeType(node, "CallNode") && !node.receiver) {
    return CONTROL_FLOW_METHODS.has(node.name)
  }

  return false
}

export function unwrapModifierStatement(node: PrismNode): PrismNode {
  if (
    !isPrismNodeType(node, "IfNode") &&
    !isPrismNodeType(node, "UnlessNode") &&
    !isPrismNodeType(node, "WhileNode") &&
    !isPrismNodeType(node, "UntilNode")
  ) {
    return node
  }

  const body = node.statements?.body
  if (!body || body.length !== 1) return node

  return body[0]
}

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

export function isSleepCall(node: PrismNode): boolean {
  if (!isPrismNodeType(node, "CallNode")) return false
  if (node.name !== "sleep") return false

  const receiver = node.receiver

  if (!receiver) return true

  return isPrismNodeType(receiver, "ConstantReadNode") && receiver.name === "Kernel"
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

