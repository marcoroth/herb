import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export abstract class BaseFormatter {
  protected projectPath?: string

  private lastReadFilename?: string
  private lastReadContent: string = ""

  constructor(projectPath?: string) {
    this.projectPath = projectPath
  }

  protected contentFor(processedFile: ProcessedFile): string {
    if (processedFile.content !== undefined) {
      return processedFile.content
    }

    if (processedFile.filename !== this.lastReadFilename) {
      this.lastReadFilename = processedFile.filename

      try {
        const filePath = this.projectPath
          ? resolve(this.projectPath, processedFile.filename)
          : resolve(processedFile.filename)

        this.lastReadContent = readFileSync(filePath, "utf-8")
      } catch {
        this.lastReadContent = ""
      }
    }

    return this.lastReadContent
  }

  abstract format(
    allOffenses: ProcessedFile[],
    isSingleFile?: boolean
  ): Promise<void>

  abstract formatFile(filename: string, offenses: Diagnostic[]): void
}
