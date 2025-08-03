import { readFileSync } from "fs"
import { resolve } from "path"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { colorize } from "@herb-tools/highlighter"
import type { Diagnostic } from "@herb-tools/core"

export interface ProcessedFile {
  filename: string
  diagnostic: Diagnostic
  content: string
}

export interface ProcessingResult {
  totalErrors: number
  totalWarnings: number
  filesWithIssues: number
  ruleCount: number
  allDiagnostics: ProcessedFile[]
  ruleViolations: Map<string, { count: number, files: Set<string> }>
}

export class FileProcessor {
  private linter: Linter | null = null

  async processFiles(files: string[]): Promise<ProcessingResult> {
    let totalErrors = 0
    let totalWarnings = 0
    let filesWithIssues = 0
    let ruleCount = 0
    const allDiagnostics: ProcessedFile[] = []
    const ruleViolations = new Map<string, { count: number, files: Set<string> }>()

    for (const filename of files) {
      const filePath = resolve(filename)
      const content = readFileSync(filePath, "utf-8")

      const parseResult = Herb.parse(content)

      if (parseResult.errors.length > 0) {
        console.error(`${colorize(filename, "cyan")} - ${colorize("Parse errors:", "brightRed")}`)

        for (const error of parseResult.errors) {
          console.error(`  ${colorize("✗", "brightRed")} ${error.message}`)
        }

        totalErrors++
        filesWithIssues++
        continue
      }

      if (!this.linter) {
        this.linter = new Linter(Herb)
      }

      const lintResult = this.linter.lint(content)

      if (ruleCount === 0) {
        ruleCount = this.linter.getRuleCount()
      }

      if (lintResult.offenses.length === 0) {
        if (files.length === 1) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
        }
      } else {
        for (const offense of lintResult.offenses) {
          allDiagnostics.push({ filename, diagnostic: offense, content })

          const ruleData = ruleViolations.get(offense.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          ruleViolations.set(offense.rule, ruleData)
        }

        totalErrors += lintResult.errors
        totalWarnings += lintResult.warnings
        filesWithIssues++
      }
    }

    return { totalErrors, totalWarnings, filesWithIssues, ruleCount, allDiagnostics, ruleViolations }
  }
}
