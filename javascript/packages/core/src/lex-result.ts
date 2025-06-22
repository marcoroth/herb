import { Result } from "./result.js"
import { TokenList } from "./token-list.js"
import { HerbError } from "./errors.js"
import { HerbWarning } from "./warning.js"

import type { SerializedHerbError } from "./errors.js"
import type { SerializedHerbWarning } from "./warning.js"
import type { SerializedTokenList } from "./token-list.js"

export type SerializedLexResult = {
  tokens: SerializedTokenList
  source: string
  warnings: SerializedHerbWarning[]
  errors: SerializedHerbError[]
}

/**
 * Represents the result of a lexical analysis, extending the base `Result` class.
 * It contains the token list, source code, warnings, and errors.
 */
export class LexResult extends Result {
  /** The list of tokens generated from the source code. */
  readonly value: TokenList

  /**
   * Creates a `LexResult` instance from a serialized result.
   * @param result - The serialized lexical result containing tokens, source, warnings, and errors.
   * @returns A new `LexResult` instance.
   */
  static from(result: SerializedLexResult) {
    return new LexResult(
      TokenList.from(result.tokens || []),
      result.source,
      result.warnings.map((warning) => HerbWarning.from(warning)),
      result.errors.map((error) => HerbError.from(error)),
    )
  }

  /**
   * Constructs a new `LexResult`.
   * @param value - The list of tokens.
   * @param source - The source code that was lexed.
   * @param warnings - An array of warnings encountered during lexing.
   * @param errors - An array of errors encountered during lexing.
   */
  constructor(
    value: TokenList,
    source: string,
    warnings: HerbWarning[] = [],
    errors: HerbError[] = [],
  ) {
    super(source, warnings, errors)
    this.value = value
  }

  /**
   * Determines if the lexing was successful.
   * @returns `true` if there are no errors, otherwise `false`.
   */
  get successful(): boolean {
    return this.errors.length === 0
  }

  /**
   * Determines if the lexing failed.
   * @returns `true` if there are errors, otherwise `false`.
   */
  get failed(): boolean {
    return this.errors.length > 0
  }

  /**
   * Converts the `LexResult` to a JSON representation.
   * @returns An object containing the token list, source, warnings, and errors.
   */
  toJSON() {
    return {
      value: this.value,
      source: this.source,
      warnings: this.warnings,
      errors: this.errors,
    }
  }
}
