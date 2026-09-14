import { Node } from "@herb-tools/core"

/**
 * Deep-copy an AST node, so it can be handed to a rewriter that mutates in
 * place while the original tree stays intact.
 *
 * Every `Node` reachable from the given node is copied, which covers everything
 * a rewriter can reassign. `Token`, `Location` and `Position` are value objects
 * that rewriters replace rather than modify, so they are shared with the
 * original. Node identity is preserved within a single copy, so a node
 * reachable through more than one path is copied once.
 *
 * @example
 * const rewritten = rewriter.rewrite(cloneNode(node), context)
 */
export function cloneNode<T extends Node>(node: T): T {
  return copyNode(node, new Map())
}

function copyNode<T extends Node>(node: T, copies: Map<Node, Node>): T {
  const existing = copies.get(node)

  if (existing) return existing as T

  const copy = Object.create(Object.getPrototypeOf(node)) as T

  copies.set(node, copy)

  for (const key of Object.keys(node)) {
    (copy as any)[key] = copyValue((node as any)[key], copies)
  }

  return copy
}

function copyValue(value: unknown, copies: Map<Node, Node>): unknown {
  if (Array.isArray(value)) return value.map(entry => copyValue(entry, copies))
  if (isNodeInstance(value)) return copyNode(value, copies)

  return value
}

/**
 * A backend can bundle its own copy of `@herb-tools/core`, which makes the
 * nodes it produces fail `instanceof Node` here, so fall back to the shape
 * every node has.
 */
function isNodeInstance(value: unknown): value is Node {
  if (value instanceof Node) return true
  if (typeof value !== "object" || value === null) return false

  return typeof (value as any).accept === "function" && typeof (value as any).compactChildNodes === "function"
}
