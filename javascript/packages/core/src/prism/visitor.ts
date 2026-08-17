import { Visitor, BasicVisitor } from "@ruby/prism/src/visitor.js"

import type * as PrismNodes from "@ruby/prism/src/nodes.js"

/**
 * Workaround for https://github.com/ruby/prism/pull/4187.
 *
 * `@ruby/prism` generates `compactChildNodes()` with `compact.concat(this.field)`
 * and discards the result, so every node list field is dropped from the
 * traversal, `when`/`in` branch conditions, multiple assignment targets,
 * `rescue` exceptions, method parameters and the pattern matching nodes.
 *
 * Walks `childNodes()` instead, which spreads those arrays correctly. Switching
 * back to `compactChildNodes()` reintroduces the bug silently. Remove this once
 * the fix ships upstream.
 */
function acceptChildNodes(visitor: BasicVisitor, node: PrismNodes.Node): void {
  for (const childNode of node.childNodes()) {
    childNode?.accept(visitor as Visitor)
  }
}

export class PrismVisitor extends Visitor {
  visitChildNodes(node: PrismNodes.Node): void {
    acceptChildNodes(this, node)
  }
}

export class PrismBasicVisitor extends BasicVisitor {
  visitChildNodes(node: PrismNodes.Node): void {
    acceptChildNodes(this, node)
  }
}
