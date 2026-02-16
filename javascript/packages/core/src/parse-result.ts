import { Result } from "./result.js"

import { DocumentNode } from "./nodes.js"
import { HerbError } from "./errors.js"
import { HerbWarning } from "./warning.js"

import type { SerializedHerbError } from "./errors.js"
import type { SerializedHerbWarning } from "./warning.js"
import type { SerializedDocumentNode } from "./nodes.js"

import type { Visitor } from "./visitor.js"

export type SerializedParserOptions = {
  strict: boolean
  track_whitespace: boolean
  analyze: boolean
}

export type SerializedParseResult = {
  value: SerializedDocumentNode
  source: string
  warnings: SerializedHerbWarning[]
  errors: SerializedHerbError[]
  strict: boolean
  track_whitespace: boolean
  analyze: boolean
}

/**
 * Represents the result of a parsing operation, extending the base `Result` class.
 * It contains the parsed document node, source code, warnings, and errors.
 */
export class ParseResult extends Result {
  /** The document node generated from the source code. */
  readonly value: DocumentNode

  /** Whether strict mode was enabled during parsing. */
  readonly strict: boolean

  /** Whether whitespace tracking was enabled during parsing. */
  readonly trackWhitespace: boolean

  /** Whether analysis was performed during parsing. */
  readonly analyze: boolean

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
      {
        strict: result.strict ?? true,
        trackWhitespace: result.track_whitespace ?? false,
        analyze: result.analyze ?? true,
      },
    )
  }

  /**
   * Constructs a new `ParseResult`.
   * @param value - The document node.
   * @param source - The source code that was parsed.
   * @param warnings - An array of warnings encountered during parsing.
   * @param errors - An array of errors encountered during parsing.
   * @param options - The parser options used during parsing.
   */
  constructor(
    value: DocumentNode,
    source: string,
    warnings: HerbWarning[] = [],
    errors: HerbError[] = [],
    options: { strict?: boolean; trackWhitespace?: boolean; analyze?: boolean } = {},
  ) {
    super(source, warnings, errors)
    this.value = value
    this.strict = options.strict ?? true
    this.trackWhitespace = options.trackWhitespace ?? false
    this.analyze = options.analyze ?? true
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
