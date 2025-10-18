import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { colorize } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"
import type { FormatOption } from "./argument-parser.js"
import { LintOffense } from "../types.js"
import { LinterTodo } from "../linter-todo.js"

export interface ProcessedFile {
  filename: string
  offense: Diagnostic
  content: string
  autocorrectable?: boolean
}

export interface ProcessingContext {
  projectPath?: string
  pattern?: string
  fix?: boolean
  generateTodo?: boolean
}

export interface ProcessingResult {
  totalErrors: number
  totalWarnings: number
  totalIgnored: number
  filesWithOffenses: number
  filesFixed: number
  ruleCount: number
  allOffenses: ProcessedFile[]
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
  context?: ProcessingContext
}

export class FileProcessor {
  private linter: Linter | null = null
  private linterTodo: LinterTodo | null = null

  private isRuleAutocorrectable(ruleName: string): boolean {
    if (!this.linter) return false

    const RuleClass = (this.linter as any).rules.find((rule: any) => {
      const instance = new rule()

      return instance.name === ruleName
    })

    if (!RuleClass) return false

    return RuleClass.autocorrectable === true
  }

  async processFiles(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {

    if (context?.projectPath) {
      this.linterTodo = new LinterTodo(context.projectPath)
    }

    if (context?.generateTodo) {
      this.linterTodo?.clearTodoFile()
    }

    let totalErrors = 0
    let totalWarnings = 0
    let totalIgnored = 0
    let filesWithOffenses = 0
    let filesFixed = 0
    let ruleCount = 0
    const allOffenses: ProcessedFile[] = []
    const ruleOffenses = new Map<string, { count: number, files: Set<string> }>()

  const todoOffenses: Record<string, LintOffense[]> = {}

  for (const filename of files) {
      const filePath = context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
      let content = readFileSync(filePath, "utf-8")
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
        this.linter = new Linter(Herb, undefined, this.linterTodo)
      }

      const lintResult = this.linter.lint(content, { fileName: filename })
      if (context?.generateTodo) {
        todoOffenses[filename] = lintResult.offenses
      }

      if (ruleCount === 0) {
        ruleCount = this.linter.getRuleCount()
      }

      if (context?.fix && lintResult.offenses.length > 0) {
        const autofixResult = this.linter.autofix(content, { fileName: filename })

        if (autofixResult.fixed.length > 0) {
          writeFileSync(filePath, autofixResult.source, "utf-8")

          filesFixed++

          if (formatOption !== 'json') {
            console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize(`Fixed ${autofixResult.fixed.length} offense(s)`, "green")}`)
          }
        }

        content = autofixResult.source

        for (const offense of autofixResult.unfixed) {
          allOffenses.push({
            filename,
            offense: offense,
            content,
            autocorrectable: this.isRuleAutocorrectable(offense.rule)
          })

          const ruleData = ruleOffenses.get(offense.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          ruleOffenses.set(offense.rule, ruleData)
        }

        if (autofixResult.unfixed.length > 0) {
          totalErrors += autofixResult.unfixed.filter(offense => offense.severity === "error").length
          totalWarnings += autofixResult.unfixed.filter(offense => offense.severity === "warning").length
          filesWithOffenses++
        }
      } else if (lintResult.offenses.length === 0) {
        if (files.length === 1 && formatOption !== 'json') {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
        }
      } else {
        for (const offense of lintResult.offenses) {
          allOffenses.push({
            filename,
            offense: offense,
            content,
            autocorrectable: this.isRuleAutocorrectable(offense.rule)
          })

          const ruleData = ruleOffenses.get(offense.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          ruleOffenses.set(offense.rule, ruleData)
        }

        totalErrors += lintResult.errors
        totalWarnings += lintResult.warnings
        filesWithOffenses++
      }
      totalIgnored += lintResult.ignored
    }

    if (context?.generateTodo) {
      this.linterTodo?.generateTodoConfig(todoOffenses)
    }

    return { totalErrors, totalWarnings, totalIgnored, filesWithOffenses, filesFixed, ruleCount, allOffenses, ruleOffenses, context }
  }
}
