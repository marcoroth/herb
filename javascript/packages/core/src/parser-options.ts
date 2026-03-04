export interface ParseOptions {
  track_whitespace?: boolean
  analyze?: boolean
  strict?: boolean
}

export type SerializedParserOptions = Required<ParseOptions>

export const DEFAULT_PARSER_OPTIONS: SerializedParserOptions = {
  track_whitespace: false,
  analyze: true,
  strict: true,
}

/**
 * Represents the parser options used during parsing.
 */
export class ParserOptions {
  /** Whether strict mode was enabled during parsing. */
  readonly strict: boolean

  /** Whether whitespace tracking was enabled during parsing. */
  readonly track_whitespace: boolean

  /** Whether analysis was performed during parsing. */
  readonly analyze: boolean

  static from(options: SerializedParserOptions): ParserOptions {
    return new ParserOptions(options)
  }

  constructor(options: ParseOptions = {}) {
    this.strict = options.strict ?? DEFAULT_PARSER_OPTIONS.strict
    this.track_whitespace = options.track_whitespace ?? DEFAULT_PARSER_OPTIONS.track_whitespace
    this.analyze = options.analyze ?? DEFAULT_PARSER_OPTIONS.analyze
  }
}
