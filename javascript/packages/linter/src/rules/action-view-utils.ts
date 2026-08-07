import { isPrismNodeType, getHelperEntries } from "@herb-tools/core"
import type { PrismNode } from "@herb-tools/core"

const ACTION_VIEW_HELPER_NAMES = new Set(
  getHelperEntries()
    .filter(helper => helper.output === "html" && helper.visibility === "public" && helper.name !== "tag")
    .flatMap(helper => [helper.name, ...helper.aliases])
)

export function isTagBuilderCall(prismNode: PrismNode): boolean {
  if (!isPrismNodeType(prismNode, "CallNode")) return false
  if (!isPrismNodeType(prismNode.receiver, "CallNode")) return false

  return prismNode.receiver.name === "tag" && !prismNode.receiver.receiver
}

export function isActionViewHelperCall(prismNode: PrismNode): { helperName: string } | null {
  if (!isPrismNodeType(prismNode, "CallNode")) return null

  if (isTagBuilderCall(prismNode)) {
    return { helperName: "tag" }
  }

  if (!prismNode.receiver && ACTION_VIEW_HELPER_NAMES.has(prismNode.name)) {
    return { helperName: prismNode.name }
  }

  return null
}

/**
 * Checks if a Prism node represents a `tag.attributes(...)` call.
 */
export function isTagAttributesCall(prismNode: PrismNode): boolean {
  if (!isPrismNodeType(prismNode, "CallNode")) return false
  if (prismNode.name !== "attributes") return false
  if (!isPrismNodeType(prismNode.receiver, "CallNode")) return false

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
  if (isPrismNodeType(prismNode, "IfNode") || isPrismNodeType(prismNode, "UnlessNode")) {
    const body = prismNode.statements?.body

    if (!Array.isArray(body) || body.length !== 1) return false

    return isTagAttributesCall(body[0])
  }

  if (isPrismNodeType(prismNode, "AndNode") || isPrismNodeType(prismNode, "OrNode")) {
    return isTagAttributesCall(prismNode.right)
  }

  return false
}
