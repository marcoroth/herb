/**
 * Formatting options for the Herb formatter.
 *
 * indentWidth: number of spaces per indentation level.
 * maxLineLength: maximum line length before wrapping text or attributes.
 */
export interface FormatOptions {
  /** number of spaces per indentation level; defaults to 2 */
  indentWidth?: number
  /** maximum line length before wrapping; defaults to 80 */
  maxLineLength?: number
}

/**
 * Default values for formatting options.
 */
export const defaultFormatOptions: Required<FormatOptions> = {
  indentWidth: 2,
  maxLineLength: 80,
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
    maxLineLength: options.maxLineLength ?? defaultFormatOptions.maxLineLength,
  }
}
