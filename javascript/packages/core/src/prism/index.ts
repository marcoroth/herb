import { deserialize } from "@ruby/prism/src/deserialize.js"
import type { ParseResult as PrismParseResult } from "@ruby/prism/src/deserialize.js"

import type * as PrismNodeTypes from "@ruby/prism/src/nodes.js"

export * as PrismNodes from "@ruby/prism/src/nodes.js"

export { Visitor as PrismVisitor, BasicVisitor as PrismBasicVisitor } from "@ruby/prism/src/visitor.js"

export type PrismNode = any
export type PrismLocation = { startOffset: number; length: number }
export type { PrismParseResult }

export { inspectPrismNode, inspectPrismSerialized } from "./inspect.js"

type PrismNodeConstructors = typeof PrismNodeTypes

type PrismNodeInstanceMap = {
  [K in keyof PrismNodeConstructors]: PrismNodeConstructors[K] extends new (...args: any[]) => infer R ? R : never
}

/**
 * Checks if a Prism node is of a specific type by comparing constructor names.
 *
 * This is preferred over `instanceof` because `@ruby/prism` classes may be
 * duplicated across bundled packages, causing `instanceof` checks to fail.
 */
export function isPrismNodeType<T extends keyof PrismNodeInstanceMap>(node: PrismNode | null | undefined, type: T): node is PrismNodeInstanceMap[T] {
  if (!node) return false

  return node.constructor?.name === type
}

/**
 * Deserialize a Prism parse result from the raw bytes produced by pm_serialize().
 *
 * @param bytes - The serialized bytes (from prism_serialized field on ERB nodes)
 * @param source - The original source string that was parsed
 * @returns The deserialized Prism ParseResult containing the AST
 */
export function deserializePrismParseResult(bytes: Uint8Array, source: string): PrismParseResult {
  const sourceBytes = new TextEncoder().encode(source)

  return deserialize(sourceBytes, bytes)
}

/**
 * Converts a UTF-8 byte offset (as reported by Prism node locations) into the
 * corresponding UTF-16 string index into `source`.
 *
 * Prism reports all offsets/lengths as UTF-8 byte counts. This only matches a
 * JS string's index/length when the source is entirely ASCII, so any offset
 * coming from a Prism node must be converted before being used with
 * `String#substring`/`String#slice` or compared against `string.length`.
 *
 * @param source - The original source string the byte offset is relative to
 * @param byteOffset - A UTF-8 byte offset, e.g. from `node.location.startOffset`
 * @returns The UTF-16 string index corresponding to `byteOffset`
 */
export function stringIndexFromByteOffset(source: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0

  const bytes = new TextEncoder().encode(source)
  const clampedOffset = Math.min(byteOffset, bytes.length)

  return new TextDecoder().decode(bytes.subarray(0, clampedOffset)).length
}

/**
 * Deserialize a Prism node from the raw bytes produced by pm_serialize().
 * pm_serialize() serializes a single node subtree, so the ParseResult's
 * value is the Prism node directly (not wrapped in ProgramNode).
 *
 * @param bytes - The serialized bytes (from prism_serialized field on ERB nodes)
 * @param source - The original source string that was parsed
 * @returns The Prism node, or null if deserialization fails
 */
export function deserializePrismNode(bytes: Uint8Array, source: string): PrismNode | null {
  try {
    const result = deserializePrismParseResult(bytes, source)

    return result.value ?? null
  } catch {
    return null
  }
}
