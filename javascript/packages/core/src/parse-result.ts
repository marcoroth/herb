import { locate, locatable } from "./locate.js"

import { Result } from "./result.js"
import { HerbError } from "./errors.js"
import { DocumentNode } from "./nodes.js"
import { HerbWarning } from "./warning.js"
import { ParserOptions } from "./parser-options.js"

import type { Position } from "./position.js"
import type { LocateResult } from "./locate.js"
import type { SerializedHerbError } from "./errors.js"
import type { SerializedHerbWarning } from "./warning.js"
import type { SerializedDocumentNode } from "./nodes.js"
import type { SerializedParserOptions } from "./parser-options.js"

import type { Visitor } from "./visitor.js"

export type SerializedParseResult = {
  value: SerializedDocumentNode
  source: string
  warnings: SerializedHerbWarning[]
  errors: SerializedHerbError[]
  options: SerializedParserOptions
  error_count: number | null
}

declare const locationless: unique symbol

/**
 * Marks a value that came out of a parse with `track_locations: false`, where
 * `location` and `range` are absent on every node and token.
 *
 * APIs that need source locations declare their parameter as
 * `T & NotLocationless` to reject these values at compile time.
 */
export type Locationless<T> = T & { readonly [locationless]: true }

/** The counterpart of {@link Locationless}, for APIs that require locations. */
export type NotLocationless = { readonly [locationless]?: never }

/**
 * The result of a parse with `track_locations: false`. Identical to
 * `ParseResult` at runtime, but its `value` cannot be passed to APIs that
 * require source locations, such as the printer and the rewriter.
 */
export interface LocationlessParseResult extends Omit<ParseResult, "value"> {
  readonly value: Locationless<DocumentNode>
  readonly [locationless]: true
}

/**
 * Resolves to `LocationlessParseResult` when `track_locations: false` was
 * passed literally, and to `ParseResult` otherwise.
 */
export type ParseResultFor<Options> = Options extends { track_locations: false } ? LocationlessParseResult : ParseResult

/**
 * Represents the result of a parsing operation, extending the base `Result` class.
 * It contains the parsed document node, source code, warnings, and errors.
 */
export class ParseResult extends Result {
  /** The document node generated from the source code. */
  readonly value: DocumentNode

  /** The parser options used during parsing. */
  readonly options: ParserOptions

  /** Total number of errors attached to the tree, counted by the parser. */
  readonly errorCount: number | null

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
      ParserOptions.from(result.options),
      result.error_count,
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
    options: ParserOptions = new ParserOptions(),
    errorCount: number | null = null,
  ) {
    super(source, warnings, errors)
    this.value = value
    this.options = options
    this.errorCount = errorCount
    this.value.setSource(source)
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
    if (this.errorCount === 0) return [...this.errors]

    return [...this.errors, ...this.value.recursiveErrors()]
  }

  /**
   * Returns a pretty-printed string of the parse result.
   * @returns A string representation of the parse result.
   */
  inspect(): string {
    return this.value.inspect()
  }

  /** The most specific node at a position, and the nodes it sits inside. */
  locate(position: Position): LocateResult | null {
    return locate(this, position)
  }

  /** Whether a position falls anywhere inside the document this parsed. */
  locatable(position: Position): boolean {
    return locatable(this, position)
  }

  /**
   * Accepts a visitor to traverse the document node.
   * @param visitor - The visitor instance.
   */
  visit(visitor: Visitor): void {
    visitor.visit(this.value)
  }
}
