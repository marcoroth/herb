/**
 * Formatting options for the Herb formatter.
 *
 * indentWidth: number of spaces per indentation level.
 * maxLineLength: maximum line length before wrapping text or attributes.
 * sortTailwindClasses: whether to sort Tailwind CSS classes in class attributes.
 */
export interface FormatOptions {
  /** number of spaces per indentation level; defaults to 2 */
  indentWidth?: number
  /** maximum line length before wrapping; defaults to 80 */
  maxLineLength?: number
  /** whether to sort Tailwind CSS classes in class attributes; defaults to false */
  sortTailwindClasses?: boolean
}

/**
 * Default values for formatting options.
 */
export const defaultFormatOptions: Required<FormatOptions> = {
  indentWidth: 2,
  maxLineLength: 80,
  sortTailwindClasses: false,
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
    sortTailwindClasses: options.sortTailwindClasses ?? defaultFormatOptions.sortTailwindClasses,
  }
}
