export interface ExtractRubyOptions {
  semicolons?: boolean
  comments?: boolean
  preserve_positions?: boolean
}

export const DEFAULT_EXTRACT_RUBY_OPTIONS: ExtractRubyOptions = {
  semicolons: true,
  comments: false,
  preserve_positions: true,
}
