import type { PrismNode } from "@herb-tools/core"

/**
 * Checks if a Prism node represents a `tag.attributes(...)` call.
 */
export function isTagAttributesCall(prismNode: PrismNode): boolean {
  if (prismNode?.constructor?.name !== "CallNode") return false
  if (prismNode.name !== "attributes") return false
  if (prismNode.receiver?.constructor?.name !== "CallNode") return false

  return prismNode.receiver.name === "tag"
}

/**
 * Checks if a Prism node wraps a `tag.attributes(...)` call in a conditional or logical expression.
 * Matches patterns like:
 * - `tag.attributes(...) if condition`
 * - `tag.attributes(...) unless condition`
 * - `condition ? tag.attributes(...) : tag.attributes(...)`
 * - `condition && tag.attributes(...)`
 * - `condition || tag.attributes(...)`
 */
export function isConditionalTagAttributesCall(prismNode: PrismNode): boolean {
  const type = prismNode?.constructor?.name

  if (type === "IfNode" || type === "UnlessNode") {
    const body = prismNode.statements?.body

    if (!Array.isArray(body) || body.length !== 1) return false

    return isTagAttributesCall(body[0])
  }

  if (type === "AndNode" || type === "OrNode") {
    return isTagAttributesCall(prismNode.right)
  }

  return false
}
