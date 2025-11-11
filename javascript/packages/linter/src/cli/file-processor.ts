import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { Config } from "@herb-tools/config"
import { WorkerPool } from "./worker-pool.js"

import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname, join } from "path"
import { fileURLToPath } from "url"
import { colorize } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"
import type { FormatOption } from "./argument-parser.js"
import type { HerbConfigOptions } from "@herb-tools/config"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
  ignoreDisableComments?: boolean
  linterConfig?: HerbConfigOptions['linter']
  config?: Config
}

export interface ProcessingResult {
  totalErrors: number
  totalWarnings: number
  totalInfo: number
  totalHints: number
  totalIgnored: number
  totalWouldBeIgnored?: number
  filesWithOffenses: number
  filesFixed: number
  ruleCount: number
  allOffenses: ProcessedFile[]
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
  context?: ProcessingContext
}

interface WorkerMessage {
  filename: string
  filePath: string
  context: ProcessingContext
  formatOption: string
}

interface WorkerResult {
  filename: string
  fileErrors: number
  fileWarnings: number
  fileInfo: number
  fileHints: number
  fileIgnored: number
  fileWouldBeIgnored: number
  hasOffenses: boolean
  wasFixed: boolean
  fileOffenses: any[]
  fileRuleOffenses: [string, number][]
  fixMessage: string | null
  error?: string
}

export class FileProcessor {
  private linter: Linter | null = null
  private workerPool: WorkerPool<WorkerMessage, WorkerResult> | null = null
  private useWorkers: boolean = true

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
    let totalErrors = 0
    let totalWarnings = 0
    let totalInfo = 0
    let totalHints = 0
    let totalIgnored = 0
    let totalWouldBeIgnored = 0
    let filesWithOffenses = 0
    let filesFixed = 0
    let ruleCount = 0
    const allOffenses: ProcessedFile[] = []
    const ruleOffenses = new Map<string, { count: number, files: Set<string> }>()

    if (!this.linter) {
      this.linter = Linter.from(Herb, context?.config)
    }

    ruleCount = this.linter.getRuleCount()

    const shouldUseWorkers = this.useWorkers && files.length >= 3

    let fileResults: WorkerResult[]

    if (shouldUseWorkers) {
      try {
        const workerScriptPath = join(__dirname, 'cli/linter-worker.js')
        this.workerPool = new WorkerPool<WorkerMessage, WorkerResult>(workerScriptPath)

        const tasks: WorkerMessage[] = files.map(filename => ({
          filename,
          filePath: context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename),
          context: context || {},
          formatOption
        }))

        fileResults = await this.workerPool.executeAll(tasks)

        this.workerPool = null
      } catch (error) {
        console.warn(`Worker pool error, falling back to single-threaded: ${error}`)
        fileResults = await this.processSingleThreaded(files, formatOption, context)
      }
    } else {
      fileResults = await this.processSingleThreaded(files, formatOption, context)
    }

    for (const fileResult of fileResults) {
      if (fileResult.fixMessage && formatOption !== 'json') {
        if (fileResult.wasFixed) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(fileResult.filename, "cyan")} - ${colorize(fileResult.fixMessage, "green")}`)
        } else if (files.length === 1) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(fileResult.filename, "cyan")} - ${colorize(fileResult.fixMessage, "green")}`)
        }
      }

      totalErrors += fileResult.fileErrors
      totalWarnings += fileResult.fileWarnings
      totalInfo += fileResult.fileInfo
      totalHints += fileResult.fileHints
      totalIgnored += fileResult.fileIgnored
      totalWouldBeIgnored += fileResult.fileWouldBeIgnored

      if (fileResult.hasOffenses) {
        filesWithOffenses++
      }

      if (fileResult.wasFixed) {
        filesFixed++
      }

      allOffenses.push(...fileResult.fileOffenses)

      const ruleOffensesArray = Array.isArray(fileResult.fileRuleOffenses)
        ? fileResult.fileRuleOffenses
        : Object.entries(fileResult.fileRuleOffenses || {})

      for (const [rule, count] of ruleOffensesArray) {
        const ruleData = ruleOffenses.get(rule) || { count: 0, files: new Set() }
        ruleData.count += (count as number)
        ruleData.files.add(fileResult.filename)
        ruleOffenses.set(rule, ruleData)
      }
    }

    const processResult: ProcessingResult = {
      totalErrors,
      totalWarnings,
      totalInfo,
      totalHints,
      totalIgnored,
      filesWithOffenses,
      filesFixed,
      ruleCount,
      allOffenses,
      ruleOffenses,
      context
    }

    if (totalWouldBeIgnored > 0) {
      processResult.totalWouldBeIgnored = totalWouldBeIgnored
    }

    return processResult
  }

  private async processSingleThreaded(files: string[], formatOption: FormatOption, context?: ProcessingContext): Promise<WorkerResult[]> {
    const results: WorkerResult[] = []

    for (const filename of files) {
      const filePath = context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
      let content = readFileSync(filePath, "utf-8")

      const lintResult = this.linter!.lint(content, {
        fileName: filename,
        ignoreDisableComments: context?.ignoreDisableComments
      })

      let fileErrors = 0
      let fileWarnings = 0
      let fileInfo = 0
      let fileHints = 0
      let fileIgnored = lintResult.ignored
      let fileWouldBeIgnored = lintResult.wouldBeIgnored || 0
      let hasOffenses = false
      let wasFixed = false
      let fixMessage: string | null = null

      const fileOffenses: ProcessedFile[] = []
      const fileRuleOffenses: [string, number][] = []

      if (context?.fix && lintResult.offenses.length > 0) {
        const autofixResult = this.linter!.autofix(content, {
          fileName: filename,
          ignoreDisableComments: context?.ignoreDisableComments
        })

        if (autofixResult.fixed.length > 0) {
          writeFileSync(filePath, autofixResult.source, "utf-8")
          wasFixed = true

          if (formatOption !== 'json') {
            fixMessage = `Fixed ${autofixResult.fixed.length} offense(s)`
          }
        }

        content = autofixResult.source

        const ruleMap = new Map<string, number>()
        for (const offense of autofixResult.unfixed) {
          fileOffenses.push({
            filename,
            offense: offense,
            content,
            autocorrectable: this.isRuleAutocorrectable(offense.rule)
          })

          ruleMap.set(offense.rule, (ruleMap.get(offense.rule) || 0) + 1)
        }

        fileRuleOffenses.push(...Array.from(ruleMap.entries()))

        if (autofixResult.unfixed.length > 0) {
          fileErrors = autofixResult.unfixed.filter(offense => offense.severity === "error").length
          fileWarnings = autofixResult.unfixed.filter(offense => offense.severity === "warning").length
          fileInfo = autofixResult.unfixed.filter(offense => offense.severity === "info").length
          fileHints = autofixResult.unfixed.filter(offense => offense.severity === "hint").length
          hasOffenses = true
        }
      } else if (lintResult.offenses.length === 0) {
        if (files.length === 1 && formatOption !== 'json') {
          fixMessage = "No issues found"
        }
      } else {
        const ruleMap = new Map<string, number>()
        for (const offense of lintResult.offenses) {
          fileOffenses.push({
            filename,
            offense: offense,
            content,
            autocorrectable: this.isRuleAutocorrectable(offense.rule)
          })

          ruleMap.set(offense.rule, (ruleMap.get(offense.rule) || 0) + 1)
        }

        fileRuleOffenses.push(...Array.from(ruleMap.entries()))

        fileErrors = lintResult.errors
        fileWarnings = lintResult.warnings
        fileInfo = lintResult.offenses.filter(o => o.severity === "info").length
        fileHints = lintResult.offenses.filter(o => o.severity === "hint").length
        hasOffenses = true
      }

      results.push({
        filename,
        fileErrors,
        fileWarnings,
        fileInfo,
        fileHints,
        fileIgnored,
        fileWouldBeIgnored,
        hasOffenses,
        wasFixed,
        fileOffenses,
        fileRuleOffenses,
        fixMessage
      })
    }

    return results
  }
}
