import { colors, ANSI_REGEX_START, ANSI_REGEX_CAPTURE } from "./color.js"

import type { Color } from "./color.js"

const BACKGROUND_RESET = "\x1b[49m"

const backgroundCode = (color: Color): string => {
  if (typeof color === "string" && color.startsWith("#")) {
    const red = parseInt(color.slice(1, 3), 16)
    const green = parseInt(color.slice(3, 5), 16)
    const blue = parseInt(color.slice(5, 7), 16)

    return `\x1b[48;2;${red};${green};${blue}m`
  }

  return colors[color as keyof typeof colors]
}

export interface BackgroundOptions {
  lineColor?: Color
  ranges?: { start: number, end: number }[]
  rangeColor?: Color
}

/**
 * Apply background tinting to already-styled text without disturbing its foreground colors.
 *
 * Ranges are expressed as indices into the text with ANSI codes stripped, so callers can
 * compute them against the plain source. The syntax renderer emits a full reset after every
 * token, which clears the background as well, so the background is re-emitted whenever a
 * reset passes by.
 *
 * @param text - The styled text
 * @param options - The line tint, the ranges to emphasize, and their tint
 * @returns The text with backgrounds applied
 */
export function applyBackground(text: string, options: BackgroundOptions): string {
  const { lineColor, ranges = [], rangeColor } = options

  if (process.env.NO_COLOR !== undefined) return text
  if (!lineColor && (ranges.length === 0 || !rangeColor)) return text

  const lineBackground = lineColor ? backgroundCode(lineColor) : ""
  const rangeBackground = rangeColor ? backgroundCode(rangeColor) : ""

  const parts = text.split(ANSI_REGEX_CAPTURE)

  let plainIndex = 0
  let active = ""
  let result = ""

  for (const part of parts) {
    if (part.length === 0) continue

    if (part.match(ANSI_REGEX_START)) {
      result += part

      if (part === colors.reset) active = ""

      continue
    }

    for (const character of part) {
      const inRange = rangeBackground !== "" && ranges.some(range => plainIndex >= range.start && plainIndex < range.end)
      const desired = inRange ? rangeBackground : lineBackground

      if (desired !== active) {
        result += desired === "" ? BACKGROUND_RESET : desired
        active = desired
      }

      result += character
      plainIndex++
    }
  }

  if (active !== "") result += BACKGROUND_RESET

  return result
}

/**
 * Slice already-styled text by plain-text indices, keeping the styling that applies.
 *
 * The codes active at `start` are re-emitted at the front of the result, so a slice taken from
 * the middle of a colored run keeps its color, and the slice is closed with a reset.
 *
 * @param text - The styled text
 * @param start - Start index into the text without ANSI codes
 * @param end - End index into the text without ANSI codes, exclusive
 * @returns The styled slice
 */
export function sliceStyled(text: string, start: number, end: number): string {
  if (process.env.NO_COLOR !== undefined) return text.slice(start, end)

  const parts = text.split(ANSI_REGEX_CAPTURE)

  let plainIndex = 0
  let active: string[] = []
  let result = ""
  let opened = false

  for (const part of parts) {
    if (part.length === 0) continue

    if (part.match(ANSI_REGEX_START)) {
      if (plainIndex <= start) {
        active = part === colors.reset ? [] : [...active, part]
      } else if (plainIndex < end) {
        result += part
      }

      continue
    }

    for (const character of part) {
      if (plainIndex >= end) break

      if (plainIndex >= start) {
        if (!opened) {
          result += active.join("")
          opened = true
        }

        result += character
      }

      plainIndex++
    }
  }

  if (result !== "" && (opened || active.length > 0)) result += colors.reset

  return result
}

export function applyDimToStyledText(text: string): string {
  const isColorEnabled = process.env.NO_COLOR === undefined

  if (!isColorEnabled) return text

  const parts = text.split(ANSI_REGEX_CAPTURE)

  let result = ""

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    if (part.match(ANSI_REGEX_START)) {
      if (part === colors.reset) {
        result += part
      } else {
        const codes = part.slice(2, -1)

        if (codes && codes !== "0" && codes !== "") {
          result += `\x1b[2;${codes}m`
        } else {
          result += part
        }
      }
    } else if (part.length > 0) {
      result += `${colors.dim}${part}\x1b[22m`
    }
  }

  return result
}
