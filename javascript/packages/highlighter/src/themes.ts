import { readFileSync } from "fs"
import { resolve } from "path"

import type { Color } from "./color.js"

import onedarkTheme from "../themes/onedark.json" assert { type: "json" }
import githubLightTheme from "../themes/github-light.json" assert { type: "json" }
import draculaTheme from "../themes/dracula.json" assert { type: "json" }
import tokyoNightTheme from "../themes/tokyo-night.json" assert { type: "json" }
import simpleTheme from "../themes/simple.json" assert { type: "json" }

export type Theme = "onedark" | "github-light" | "dracula" | "tokyo-night" | "simple"
export type ThemeInput = Theme | string

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
}

// Built-in themes are now bundled directly
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

export function loadCustomTheme(themePath: string): ColorScheme {
  try {
    const absolutePath = resolve(themePath)
    const themeContent = readFileSync(absolutePath, 'utf-8')
    const customTheme = JSON.parse(themeContent) as ColorScheme

    const requiredKeys = Object.keys(themes.onedark) as (keyof ColorScheme)[]
    const customKeys = Object.keys(customTheme) as (keyof ColorScheme)[]

    const missingKeys = requiredKeys.filter(key => !customKeys.includes(key))

    if (missingKeys.length > 0) {
      throw new Error(`Custom theme is missing required properties: ${missingKeys.join(', ')}`)
    }

    return customTheme
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load custom theme from ${themePath}: ${error.message}`)
    }

    throw new Error(`Failed to load custom theme from ${themePath}`)
  }
}

export function resolveTheme(themeInput: ThemeInput): ColorScheme {
  if (isValidTheme(themeInput)) {
    return getTheme(themeInput)
  }

  return loadCustomTheme(themeInput)
}

export function isCustomTheme(themeInput: ThemeInput): boolean {
  return !isValidTheme(themeInput)
}
