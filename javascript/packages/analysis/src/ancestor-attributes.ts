import { getAttribute, getStaticAttributeValue } from "@herb-tools/core"

import type { HTMLElementNode } from "@herb-tools/core"
import type { StaticAttributeMap } from "./render-graph-utils"

export const ANCESTOR_CONTEXT_ATTRIBUTES = [
  "class",
] as const

export function staticAncestorAttributes(element: HTMLElementNode): StaticAttributeMap {
  const attributes: StaticAttributeMap = {}

  for (const name of ANCESTOR_CONTEXT_ATTRIBUTES) {
    const attribute = getAttribute(element, name)

    if (!attribute) continue

    if (!attribute.value) {
      attributes[name] = ""
      continue
    }

    const value = getStaticAttributeValue(attribute)
    if (value !== null) attributes[name] = value
  }

  return attributes
}
