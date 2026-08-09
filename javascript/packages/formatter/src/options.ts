import type { ASTRewriter, StringRewriter } from "@herb-tools/rewriter"
import type { IndentStyle } from "@herb-tools/printer"

/**
 * Formatting options for the Herb formatter.
 *
 * indentWidth: number of spaces per indentation level.
 * indentStyle: character used for indentation, "space" or "tab".
 * maxLineLength: maximum line length before wrapping text or attributes.
 * preRewriters: AST rewriters to run before formatting.
 * postRewriters: String rewriters to run after formatting.
 */
export interface FormatOptions {
  /** number of spaces per indentation level; defaults to 2 */
  indentWidth?: number
  /** character used for indentation; defaults to "space" */
  indentStyle?: IndentStyle
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
  indentStyle: "space",
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
    indentStyle: options.indentStyle ?? defaultFormatOptions.indentStyle,
    maxLineLength: options.maxLineLength ?? defaultFormatOptions.maxLineLength,
    preRewriters: options.preRewriters ?? defaultFormatOptions.preRewriters,
    postRewriters: options.postRewriters ?? defaultFormatOptions.postRewriters,
  }
}
