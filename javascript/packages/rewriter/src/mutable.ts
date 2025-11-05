/**
 * Utility type for making readonly properties mutable
 *
 * This is useful when you need to modify AST nodes which typically have
 * readonly properties. Use sparingly and only in rewriter contexts.
 */
export type Mutable<T> = T extends ReadonlyArray<infer U>
  ? Array<Mutable<U>>
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T

/**
 * Cast a readonly value to a mutable version
 *
 * @example
 * const literalNode = asMutable(node)
 * literalNode.content = "new value"
 */
export function asMutable<T>(node: T): Mutable<T> {
  return node as Mutable<T>
}
