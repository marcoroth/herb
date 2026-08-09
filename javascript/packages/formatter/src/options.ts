import type { ASTRewriter, StringRewriter } from "@herb-tools/rewriter"
import type { IndentType } from "@herb-tools/printer"

/**
 * Formatting options for the Herb formatter.
 *
 * indentWidth: number of spaces per indentation level.
 * indentType: character used for indentation, "spaces" or "tabs".
 * maxLineLength: maximum line length before wrapping text or attributes.
 * preRewriters: AST rewriters to run before formatting.
 * postRewriters: String rewriters to run after formatting.
 */
export interface FormatOptions {
  /** number of spaces per indentation level; defaults to 2 */
  indentWidth?: number
  /** character used for indentation; defaults to "spaces" */
  indentType?: IndentType
  /** maximum line length before wrapping; defaults to 80 */
  maxLineLength?: number
  /** Pre-format rewriters (transform AST before formatting); defaults to [] */
  preRewriters?: ASTRewriter[]
  /** Post-format rewriters (transform string after formatting); defaults to [] */
  postRewriters?: StringRewriter[]
}

/**
 * Default values for formatting options.
 */
export const defaultFormatOptions: Required<FormatOptions> = {
  indentWidth: 2,
  indentType: "spaces",
  maxLineLength: 80,
  preRewriters: [],
  postRewriters: [],
}

/**
 * Merge provided options with defaults for any missing values.
 * @param options partial formatting options
 * @returns a complete set of formatting options
 */
export function resolveFormatOptions(
  options: FormatOptions = {},
): Required<FormatOptions> {
  return {
    indentWidth: options.indentWidth ?? defaultFormatOptions.indentWidth,
    indentType: options.indentType ?? defaultFormatOptions.indentType,
    maxLineLength: options.maxLineLength ?? defaultFormatOptions.maxLineLength,
    preRewriters: options.preRewriters ?? defaultFormatOptions.preRewriters,
    postRewriters: options.postRewriters ?? defaultFormatOptions.postRewriters,
  }
}
