import { readFileSync } from "fs"
import { resolve } from "path"

import { assertColorScheme, isValidTheme, getTheme } from "./themes.js"

import { Highlighter } from "./highlighter.js"

import type { Diagnostic, HerbBackend } from "@herb-tools/core"
import type { HighlightOptions, HighlightDiagnosticOptions } from "./highlighter.js"
import type { ColorScheme, ThemeInput } from "./themes.js"

function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8")
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Read and validate a theme from a JSON file on disk.
 */
export function loadCustomTheme(themePath: string): ColorScheme {
  try {
    return assertColorScheme(JSON.parse(readFileSync(resolve(themePath), "utf-8")) as ColorScheme)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load custom theme from ${themePath}: ${error.message}`)
    }

    throw new Error(`Failed to load custom theme from ${themePath}`)
  }
}

/**
 * Resolve a theme the way a CLI needs to, where a name and a path to a theme
 * file are both valid user input.
 */
export function resolveThemeInput(themeInput: ThemeInput): ColorScheme {
  if (typeof themeInput !== "string") return themeInput
  if (isValidTheme(themeInput)) return getTheme(themeInput)

  return loadCustomTheme(themeInput)
}

/**
 * Read a file and highlight it.
 */
export function highlightFileFromPath(highlighter: Highlighter, filePath: string, options: HighlightOptions = {}): string {
  return highlighter.highlight(filePath, readFile(filePath), options)
}

/**
 * Read a file and render a diagnostic against it.
 */
export function highlightDiagnosticFromPath(highlighter: Highlighter, filePath: string, diagnostic: Diagnostic, options: HighlightDiagnosticOptions = {}): string {
  return highlighter.highlightDiagnostic(filePath, diagnostic, readFile(filePath), options)
}

/**
 * Convenience function to highlight content with a specific theme
 * @param content - The content to highlight
 * @param herb - The backend to parse with
 * @param theme - The theme to use (defaults to "onedark")
 * @param options - Additional highlighting options
 * @returns The highlighted content
 */
export async function highlightContent(content: string, herb: HerbBackend, theme: ThemeInput = "onedark", options: HighlightOptions = {}): Promise<string> {
  const highlighter = new Highlighter(resolveThemeInput(theme), herb)
  await highlighter.initialize()
  return highlighter.highlight("", content, options)
}

/**
 * Convenience function to highlight a file with a specific theme
 * @param filePath - The path to the file to highlight
 * @param herb - The backend to parse with
 * @param theme - The theme to use (defaults to "onedark")
 * @param options - Additional highlighting options
 * @returns The highlighted file content
 */
export async function highlightFile(filePath: string, herb: HerbBackend, theme: ThemeInput = "onedark", options: HighlightOptions = {}): Promise<string> {
  const highlighter = new Highlighter(resolveThemeInput(theme), herb)
  await highlighter.initialize()
  return highlightFileFromPath(highlighter, filePath, options)
}
