import { readFileSync } from "fs"
import { resolve } from "path"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { colorize } from "@herb-tools/highlighter"
import type { Diagnostic } from "@herb-tools/core"
import type { FormatOption } from "./argument-parser.js"

export interface ProcessedFile {
  filename: string
  offense: Diagnostic
  content: string
}

export interface ProcessingContext {
  projectPath?: string
  pattern?: string
  loadCustomRules?: boolean
}

export interface ProcessingResult {
  totalErrors: number
  totalWarnings: number
  filesWithOffenses: number
  ruleCount: number
  allOffenses: ProcessedFile[]
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
  context?: ProcessingContext
}

export class FileProcessor {
  private linter: Linter | null = null
  private customRulesLoaded: boolean = false

  async processFiles(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {
    let totalErrors = 0
    let totalWarnings = 0
    let filesWithOffenses = 0
    let ruleCount = 0
    const allOffenses: ProcessedFile[] = []
    const ruleOffenses = new Map<string, { count: number, files: Set<string> }>()

    for (const filename of files) {
      const filePath = context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
      const content = readFileSync(filePath, "utf-8")
      const parseResult = Herb.parse(content)

      if (parseResult.errors.length > 0) {
        if (formatOption !== 'json') {
          console.error(`${colorize(filename, "cyan")} - ${colorize("Parse errors:", "brightRed")}`)

          for (const error of parseResult.errors) {
            console.error(`  ${colorize("✗", "brightRed")} ${error.message}`)
          }
        }

        for (const error of parseResult.errors) {
          allOffenses.push({ filename, offense: error, content })
        }

        totalErrors++
        filesWithOffenses++
        continue
      }

      if (!this.linter) {
        this.linter = new Linter(Herb)

        if (context?.loadCustomRules && !this.customRulesLoaded) {
          try {
            const { count, ruleInfo, warnings } = await this.linter.loadCustomRules({
              baseDir: context.projectPath,
              silent: formatOption === 'json'
            })

            this.customRulesLoaded = true

            if (count > 0 && formatOption !== 'json') {
              console.log(colorize(`\nLoaded ${count} custom rule(s):`, "green"))

              for (const { name, path } of ruleInfo) {
                const relativePath = context.projectPath ? path.replace(context.projectPath + '/', '') : path

                console.log(colorize(`  • ${name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
              }

              if (warnings.length > 0) {
                console.log()
                for (const warning of warnings) {
                  console.warn(colorize(`  ⚠ ${warning}`, "yellow"))
                }
              }

              console.log()
            }
          } catch (error) {
            if (formatOption !== 'json') {
              console.warn(colorize(`Warning: Failed to load custom rules: ${error}`, "yellow"))
            }
          }
        }
      }

      const lintResult = this.linter.lint(content, { fileName: filename })

      if (ruleCount === 0) {
        ruleCount = this.linter.getRuleCount()
      }

      if (lintResult.offenses.length === 0) {
        if (files.length === 1 && formatOption !== 'json') {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
        }
      } else {
        for (const offense of lintResult.offenses) {
          allOffenses.push({ filename, offense: offense, content })

          const ruleData = ruleOffenses.get(offense.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          ruleOffenses.set(offense.rule, ruleData)
        }

        totalErrors += lintResult.errors
        totalWarnings += lintResult.warnings
        filesWithOffenses++
      }
    }

    return { totalErrors, totalWarnings, filesWithOffenses, ruleCount, allOffenses, ruleOffenses, context }
  }
}
