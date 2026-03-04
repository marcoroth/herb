import type { Diagnostic } from "@herb-tools/core"
import type { ProcessedFile } from "../file-processor.js"

export abstract class BaseFormatter {
  abstract format(
    allOffenses: ProcessedFile[],
    isSingleFile?: boolean
  ): Promise<void>

  abstract formatFile(filename: string, offenses: Diagnostic[]): void
}
