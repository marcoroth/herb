import type { Arena } from "./arena.js"

export interface ParserOptions {
  track_whitespace?: boolean
  analyze?: boolean
  strict?: boolean
  arena?: Arena
}

export const DEFAULT_PARSER_OPTIONS: Omit<ParserOptions, 'arena'> = {
  track_whitespace: false,
  analyze: true,
  strict: true,
}
