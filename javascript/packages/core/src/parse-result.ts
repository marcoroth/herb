import { Result } from "./result.js"
import { DocumentNode } from "./nodes.js"

import type { HerbError, HerbWarning, SerializedDocumentNode } from "./nodes.js"
import type { Visitor } from "./visitor.js"

export type SerializedParseResult = {
  value: SerializedDocumentNode
  source: string
  warnings: HerbWarning[]
  errors: HerbError[]
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
      result.warnings,
      result.errors,
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
  failed(): boolean {
    // TODO: this should probably be recursive as noted in the Ruby version
    return this.errors.length > 0 || this.value.errors.length > 0
  }

  /**
   * Determines if the parsing was successful.
   * @returns `true` if there are no errors, otherwise `false`.
   */
  success(): boolean {
    return !this.failed()
  }

  /**
   * Returns a pretty-printed JSON string of the errors.
   * @returns A string representation of the errors.
   */
  prettyErrors(): string {
    return JSON.stringify([...this.errors, ...this.value.errors], null, 2)
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
