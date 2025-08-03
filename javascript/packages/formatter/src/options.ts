/**
 * Formatting options for the Herb formatter.
 *
 * indentWidth: number of spaces per indentation level.
 * maxLineLength: maximum line length before wrapping text or attributes.
 * rewriters: rewriters to apply before and after formatting.
 */

import type { Rewriter } from "@herb-tools/rewriter"

export interface FormatOptions {
  /** number of spaces per indentation level; defaults to 2 */
  indentWidth?: number
  /** maximum line length before wrapping; defaults to 80 */
  maxLineLength?: number
  /** rewriters to apply at different stages of formatting */
  rewriters?: {
    /** rewriters to apply before formatting (after parsing) */
    before?: Rewriter[]
    /** rewriters to apply after formatting (before output) */
    after?: Rewriter[]
  }
}

/**
 * Default values for formatting options.
 */
export const defaultFormatOptions: Required<Pick<FormatOptions, 'indentWidth' | 'maxLineLength'>> & Pick<FormatOptions, 'rewriters'> = {
  indentWidth: 2,
  maxLineLength: 80,
  rewriters: {
    before: [],
    after: []
  }
}

/**
 * Merge provided options with defaults for any missing values.
 * @param options partial formatting options
 * @returns a complete set of formatting options
 */
export function resolveFormatOptions(
  options: FormatOptions = {},
): Required<Pick<FormatOptions, 'indentWidth' | 'maxLineLength'>> & Pick<FormatOptions, 'rewriters'> {
  return {
    indentWidth: options.indentWidth ?? defaultFormatOptions.indentWidth,
    maxLineLength: options.maxLineLength ?? defaultFormatOptions.maxLineLength,
    rewriters: options.rewriters ?? defaultFormatOptions.rewriters,
  }
}
