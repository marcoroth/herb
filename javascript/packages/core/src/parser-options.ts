export interface ParserOptions {
  track_whitespace?: boolean
  analyze?: boolean
  strict?: boolean
}

export const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  track_whitespace: false,
  analyze: true,
  strict: true,
}
