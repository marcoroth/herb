export interface ParseOptions {
  track_whitespace?: boolean
  analyze?: boolean
  strict?: boolean
  action_view_helpers?: boolean
  prism_nodes?: boolean
  prism_nodes_deep?: boolean
  prism_program?: boolean
}

export type SerializedParserOptions = Required<ParseOptions>

export const DEFAULT_PARSER_OPTIONS: SerializedParserOptions = {
  track_whitespace: false,
  analyze: true,
  strict: true,
  action_view_helpers: false,
  prism_nodes: false,
  prism_nodes_deep: false,
  prism_program: false,
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

  /** Whether ActionView tag helper transformation was enabled during parsing. */
  readonly action_view_helpers: boolean

  /** Whether Prism node serialization was enabled during parsing. */
  readonly prism_nodes: boolean

  /** Whether deep Prism node serialization was enabled during parsing. */
  readonly prism_nodes_deep: boolean

  /** Whether the full Prism ProgramNode was serialized on the DocumentNode. */
  readonly prism_program: boolean

  static from(options: SerializedParserOptions): ParserOptions {
    return new ParserOptions(options)
  }

  constructor(options: ParseOptions = {}) {
    this.strict = options.strict ?? DEFAULT_PARSER_OPTIONS.strict
    this.track_whitespace = options.track_whitespace ?? DEFAULT_PARSER_OPTIONS.track_whitespace
    this.analyze = options.analyze ?? DEFAULT_PARSER_OPTIONS.analyze
    this.action_view_helpers = options.action_view_helpers ?? DEFAULT_PARSER_OPTIONS.action_view_helpers
    this.prism_nodes = options.prism_nodes ?? DEFAULT_PARSER_OPTIONS.prism_nodes
    this.prism_nodes_deep = options.prism_nodes_deep ?? DEFAULT_PARSER_OPTIONS.prism_nodes_deep
    this.prism_program = options.prism_program ?? DEFAULT_PARSER_OPTIONS.prism_program
  }
}
