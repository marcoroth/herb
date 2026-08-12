import { Node, isToken } from "@herb-tools/core"

import type { Token } from "@herb-tools/core"

/**
 * Deep-copy an AST node, so it can be handed to a consumer that mutates in
 * place while the original tree stays intact.
 *
 * Every `Node` and every `Token` reachable from the given node is copied.
 * Tokens are copied because consumers do write to them, the linter's autofix
 * rules assign to `token.value` to correct a tag name or a quote. `Location`,
 * `Position` and `Range` are never written to, so they are shared with the
 * original. Object identity is preserved within a single copy, so anything
 * reachable through more than one path is copied once.
 *
 * @example
 * const rewritten = rewriter.rewrite(cloneNode(node), context)
 */
export function cloneNode<T extends Node>(node: T): T {
  return copyNode(node, new Map())
}

function copyNode<T extends Node>(node: T, copies: Map<object, object>): T {
  return copyObject(node, copies)
}

function copyObject<T extends object>(object: T, copies: Map<object, object>): T {
  const existing = copies.get(object)

  if (existing) return existing as T

  const copy = Object.create(Object.getPrototypeOf(object)) as T

  copies.set(object, copy)

  for (const key of Object.keys(object)) {
    (copy as any)[key] = copyValue((object as any)[key], copies)
  }

  return copy
}

function copyValue(value: unknown, copies: Map<object, object>): unknown {
  if (Array.isArray(value)) return value.map(entry => copyValue(entry, copies))
  if (typeof value !== "object" || value === null) return value
  if (isNodeInstance(value)) return copyObject(value, copies)
  if (isToken(value)) return copyObject(value as Token, copies)

  return value
}

/**
 * A backend can bundle its own copy of `@herb-tools/core`, which makes the
 * nodes it produces fail `instanceof Node` here, so fall back to the shape
 * every node has.
 */
function isNodeInstance(value: unknown): value is Node {
  if (value instanceof Node) return true

  return typeof (value as any).accept === "function" && typeof (value as any).compactChildNodes === "function"
}
