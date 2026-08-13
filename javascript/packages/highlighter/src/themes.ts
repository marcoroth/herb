import type { Color } from "./color.js"

import onedarkTheme from "../themes/onedark.json" with { type: "json" }
import githubLightTheme from "../themes/github-light.json" with { type: "json" }
import draculaTheme from "../themes/dracula.json" with { type: "json" }
import tokyoNightTheme from "../themes/tokyo-night.json" with { type: "json" }
import simpleTheme from "../themes/simple.json" with { type: "json" }

export type Theme = "onedark" | "github-light" | "dracula" | "tokyo-night" | "simple"
export type ThemeInput = Theme | string | ColorScheme

export const THEME_NAMES = ["onedark", "github-light", "dracula", "tokyo-night", "simple"] as const
export const DEFAULT_THEME: Theme = "onedark"

export interface ColorScheme {
  // Whitespace and special characters
  TOKEN_WHITESPACE: Color | null
  TOKEN_NBSP: Color | null
  TOKEN_NEWLINE: Color | null
  TOKEN_IDENTIFIER: Color

  // Ruby syntax highlighting colors
  RUBY_KEYWORD: Color

  // HTML DOCTYPE
  TOKEN_HTML_DOCTYPE: Color

  // HTML Tags
  TOKEN_HTML_TAG_START: Color
  TOKEN_HTML_TAG_START_CLOSE: Color
  TOKEN_HTML_TAG_END: Color
  TOKEN_HTML_TAG_SELF_CLOSE: Color

  // HTML Comments
  TOKEN_HTML_COMMENT_START: Color
  TOKEN_HTML_COMMENT_END: Color

  // ERB Tags
  TOKEN_ERB_START: Color
  TOKEN_ERB_CONTENT: Color
  TOKEN_ERB_END: Color

  // Punctuation and symbols
  TOKEN_LT: Color
  TOKEN_SLASH: Color
  TOKEN_EQUALS: Color
  TOKEN_QUOTE: Color
  TOKEN_DASH: Color
  TOKEN_UNDERSCORE: Color
  TOKEN_EXCLAMATION: Color
  TOKEN_SEMICOLON: Color
  TOKEN_COLON: Color
  TOKEN_PERCENT: Color
  TOKEN_AMPERSAND: Color

  // Special tokens
  TOKEN_CHARACTER: Color
  TOKEN_ERROR: Color
  TOKEN_EOF: Color | null

  // Surface the output is meant to be read on
  BACKGROUND?: Color
  FOREGROUND?: Color

  // What a terminal renders the sixteen base ANSI colors as
  ANSI_PALETTE?: Record<string, Color>

  // Diff backgrounds
  DIFF_REMOVED_LINE_BACKGROUND?: Color
  DIFF_ADDED_LINE_BACKGROUND?: Color
  DIFF_REMOVED_BACKGROUND?: Color
  DIFF_ADDED_BACKGROUND?: Color
}

/**
 * Keys a custom theme may leave out. Everything else in `ColorScheme` is required.
 */
export const OPTIONAL_COLOR_SCHEME_KEYS: readonly (keyof ColorScheme)[] = [
  "BACKGROUND",
  "FOREGROUND",
  "ANSI_PALETTE",
  "DIFF_REMOVED_LINE_BACKGROUND",
  "DIFF_ADDED_LINE_BACKGROUND",
  "DIFF_REMOVED_BACKGROUND",
  "DIFF_ADDED_BACKGROUND",
]

export const themes: Record<Theme, ColorScheme> = {
  onedark: onedarkTheme as ColorScheme,
  "github-light": githubLightTheme as ColorScheme,
  dracula: draculaTheme as ColorScheme,
  "tokyo-night": tokyoNightTheme as ColorScheme,
  simple: simpleTheme as ColorScheme
}

export function isValidTheme(theme: string): theme is Theme {
  return THEME_NAMES.includes(theme as Theme)
}

export function getThemeNames(): readonly string[] {
  return THEME_NAMES
}

export function getTheme(theme: Theme): ColorScheme {
  return themes[theme]
}

export function getDefaultTheme(): Theme {
  return DEFAULT_THEME
}

export function assertColorScheme(customTheme: ColorScheme): ColorScheme {
  const requiredKeys = (Object.keys(themes.onedark) as (keyof ColorScheme)[])
    .filter(key => !OPTIONAL_COLOR_SCHEME_KEYS.includes(key))
  const customKeys = Object.keys(customTheme) as (keyof ColorScheme)[]

  const missingKeys = requiredKeys.filter(key => !customKeys.includes(key))

  if (missingKeys.length > 0) {
    throw new Error(`Custom theme is missing required properties: ${missingKeys.join(', ')}`)
  }

  return customTheme
}

export function resolveTheme(themeInput: ThemeInput): ColorScheme {
  if (typeof themeInput !== "string") {
    return themeInput
  }

  if (isValidTheme(themeInput)) {
    return getTheme(themeInput)
  }

  throw new Error(`Unknown theme "${themeInput}". The built-in themes are ${THEME_NAMES.join(", ")}. To use a theme file, load it with loadCustomTheme() from @herb-tools/highlighter and pass the result.`)
}

export function isCustomTheme(themeInput: ThemeInput): boolean {
  return typeof themeInput !== "string" || !isValidTheme(themeInput)
}
