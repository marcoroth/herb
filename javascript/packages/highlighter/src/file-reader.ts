import { readFileSync } from "fs"
import type { Diagnostic } from "@herb-tools/core"
import type { HighlightOptions, HighlightDiagnosticOptions } from "./highlighter.js"

export class FileReader {
  private highlighter: any

  constructor(highlighter: any) {
    this.highlighter = highlighter
  }

  highlightFromPath(
    filePath: string,
    options: HighlightOptions = {},
  ): string {
    this.highlighter.requireInitialized()

    try {
      const content = readFileSync(filePath, "utf8")
      return this.highlighter.highlight(filePath, content, options)
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  highlightDiagnosticFromPath(
    filePath: string,
    diagnostic: Diagnostic,
    options: HighlightDiagnosticOptions = {},
  ): string {
    this.highlighter.requireInitialized()

    try {
      const content = readFileSync(filePath, "utf8")
      return this.highlighter.highlightDiagnostic(filePath, diagnostic, content, options)
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}