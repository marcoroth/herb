import { DOM_NODE } from "./dom-to-ast.js"

import { SourcePath } from "@herb-tools/core"

import type { Node } from "@herb-tools/core"
import type { DOMNodeLike, DOMElementLike, WithDOMNode } from "./dom-to-ast.js"

export const SOURCE_ATTRIBUTE = "data-herb-source"

function attributeValue(element: DOMElementLike, name: string): string | null {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === name) {
      return attribute.value
    }
  }

  return null
}

export function sourcePathFor(node: Node, projectPath: string | null = null): SourcePath | null {
  const element = (node as Node & WithDOMNode)[DOM_NODE]
  if (!element) return null

  let current: DOMNodeLike | null = element

  while (current) {
    if (current.nodeType === 1) {
      const stamp = attributeValue(current as DOMElementLike, SOURCE_ATTRIBUTE)

      if (stamp) {
        return SourcePath.parse(stamp, projectPath)
      }
    }

    current = (current as { parentNode?: DOMNodeLike | null }).parentNode ?? null
  }

  return null
}
