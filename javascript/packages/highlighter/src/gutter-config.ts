/**
 * Configuration for gutter formatting in the highlighter
 */

// Calculate the gutter width based on the format: "    123 │ "
// - 4 spaces for indentation
// - 3 characters for line number (supports up to 999 lines)
// - 1 space after line number
// - 1 character for separator (│)
// - 1 space after separator
export const GUTTER_WIDTH = 4 + 3 + 1 + 1 + 1; // = 10

// Minimum content width to ensure readability
export const MIN_CONTENT_WIDTH = 40;
