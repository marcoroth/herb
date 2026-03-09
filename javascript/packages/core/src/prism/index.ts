import { deserialize } from "@ruby/prism/src/deserialize.js"
import type { ParseResult as PrismParseResult } from "@ruby/prism/src/deserialize.js"

export * as PrismNodes from "@ruby/prism/src/nodes.js"

export { Visitor as PrismVisitor, BasicVisitor as PrismBasicVisitor } from "@ruby/prism/src/visitor.js"

export type PrismNode = any
export type PrismLocation = { startOffset: number; length: number }
export type { PrismParseResult }

export { inspectPrismNode, inspectPrismSerialized } from "./inspect.js"

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
