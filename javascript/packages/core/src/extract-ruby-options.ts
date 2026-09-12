import type { LexOptions } from "./parser-options.js"

export interface ExtractRubyOptions extends LexOptions {
  semicolons?: boolean
  comments?: boolean
  preserve_positions?: boolean
  custom_tags?: boolean
}

export const DEFAULT_EXTRACT_RUBY_OPTIONS: ExtractRubyOptions = {
  semicolons: true,
  comments: false,
  preserve_positions: true,
  custom_tags: false,
}
