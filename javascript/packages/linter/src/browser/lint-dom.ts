import { DOM_NODE, SOURCE_ATTRIBUTE, sourcePathForElement } from "./dom-to-ast.js"

import type { Node } from "@herb-tools/core"
import type { SourcePath } from "@herb-tools/core"
import type { WithDOMNode } from "./dom-to-ast.js"

export { SOURCE_ATTRIBUTE }

export function sourcePathFor(node: Node, projectPath: string | null = null): SourcePath | null {
  return sourcePathForElement((node as Node & WithDOMNode)[DOM_NODE], projectPath)
}
