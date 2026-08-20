import { colorize, hyperlink } from "./color.js"

import type { Color } from "./color.js"

// The width of the gutter, in the format "    123 │ ":
// - 4 spaces of indentation
// - 3 characters for the line number (supports up to 999 lines)
// - 1 space after the line number
// - 1 character for the separator (│)
// - 1 space after the separator
export const GUTTER_WIDTH = 4 + 3 + 1 + 1 + 1;
export const MIN_CONTENT_WIDTH = 40;

export const separator = (): string => colorize("│", "gray")

export const lineNumber = (number: number, emphasized: boolean, url?: string): string => {
  const label = colorize(number.toString().padStart(3, " "), emphasized ? "bold" : "gray")

  return url ? hyperlink(label, url) : label
}

export const markerPrefix = (marker?: Color): string => marker ? colorize("  → ", marker) : "    "
export const linePrefix = (number: number, emphasized: boolean, marker?: Color, url?: string): string => `${markerPrefix(marker)}${lineNumber(number, emphasized, url)} ${separator()} `
export const pointerPrefix = (): string => `        ${separator()}`
export const continuationPrefix = (): string => `        ${separator()} `
export const availableWidth = (maxWidth: number): number => Math.max(MIN_CONTENT_WIDTH, maxWidth - GUTTER_WIDTH)
