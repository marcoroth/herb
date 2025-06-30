import { Result } from "./result.js"

import { DocumentNode } from "./nodes.js"
import { HerbError } from "./errors.js"
import { HerbWarning } from "./warning.js"

import type { SerializedHerbError } from "./errors.js"
import type { SerializedHerbWarning } from "./warning.js"
import type { SerializedDocumentNode } from "./nodes.js"

import type { Visitor } from "./visitor.js"

export type SerializedParseResult = {
  value: SerializedDocumentNode
  source: string
  warnings: SerializedHerbWarning[]
  errors: SerializedHerbError[]
}

/**
 * Represents the result of a parsing operation, extending the base `Result` class.
 * It contains the parsed document node, source code, warnings, and errors.
 */
export class ParseResult extends Result {
  /** The document node generated from the source code. */
  readonly value: DocumentNode

  /**
   * Creates a `ParseResult` instance from a serialized result.
   * @param result - The serialized parse result containing the value and source.
   * @returns A new `ParseResult` instance.
   */
  static from(result: SerializedParseResult) {
    return new ParseResult(
      DocumentNode.from(result.value),
      result.source,
      result.warnings.map((warning) => HerbWarning.from(warning)),
      result.errors.map((error) => HerbError.from(error)),
    )
  }

  /**
   * Constructs a new `ParseResult`.
   * @param value - The document node.
   * @param source - The source code that was parsed.
   * @param warnings - An array of warnings encountered during parsing.
   * @param errors - An array of errors encountered during parsing.
   */
  constructor(
    value: DocumentNode,
    source: string,
    warnings: HerbWarning[] = [],
    errors: HerbError[] = [],
  ) {
    super(source, warnings, errors)
    this.value = value
  }

  /**
   * Determines if the parsing failed.
   * @returns `true` if there are errors, otherwise `false`.
   */
  get failed(): boolean {
    // Consider errors on this result and recursively in the document tree
    return this.recursiveErrors().length > 0
  }

  /**
   * Determines if the parsing was successful.
   * @returns `true` if there are no errors, otherwise `false`.
   */
  get successful(): boolean {
    return !this.failed
  }

  /**
   * Returns a pretty-printed JSON string of the errors.
   * @returns A string representation of the errors.
   */
  prettyErrors(): string {
    return JSON.stringify([...this.errors, ...this.value.errors], null, 2)
  }

  recursiveErrors(): HerbError[] {
    return [...this.errors, ...this.value.recursiveErrors()]
  }

  /**
   * Returns a pretty-printed string of the parse result.
   * @returns A string representation of the parse result.
   */
  inspect(): string {
    return this.value.inspect()
  }

  /**
   * Accepts a visitor to traverse the document node.
   * @param visitor - The visitor instance.
   */
  visit(visitor: Visitor): void {
    visitor.visit(this.value)
  }
}
