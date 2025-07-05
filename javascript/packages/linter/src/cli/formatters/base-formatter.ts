import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export abstract class BaseFormatter {
  abstract format(
    allDiagnostics: ProcessedFile[],
    isSingleFile?: boolean
  ): Promise<void>

  abstract formatFile(filename: string, diagnostics: Diagnostic[]): void
}
