import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { loadCustomRules } from "../loader.js"
import { Config } from "@herb-tools/config"

import { Worker } from "node:worker_threads"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { availableParallelism } from "node:os"
import { colorize } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"
import type { FormatOption } from "./argument-parser.js"
import type { HerbConfigOptions } from "@herb-tools/config"
import type { WorkerInput, WorkerResult } from "./lint-worker.js"

export interface ProcessedFile {
  filename: string
  offense: Diagnostic
  content: string
  autocorrectable?: boolean
}

export interface ProcessingContext {
  projectPath?: string
  configPath?: string
  pattern?: string
  fix?: boolean
  fixUnsafe?: boolean
  ignoreDisableComments?: boolean
  linterConfig?: HerbConfigOptions['linter']
  config?: Config
  loadCustomRules?: boolean
  jobs?: number
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

/**
 * Minimum number of files required to use parallel processing.
 * Below this threshold, sequential processing is faster due to
 * worker thread startup overhead (loading WASM, config, etc.).
 */
const PARALLEL_FILE_THRESHOLD = 10

export class FileProcessor {
  private linter: Linter | null = null
  private customRulesLoaded: boolean = false

  private isRuleAutocorrectable(ruleName: string): boolean {
    if (!this.linter) return false

    const ruleClass = (this.linter as any).rules.find(
      (rule: any) => rule.ruleName === ruleName
    )

    if (!ruleClass) return false

    return ruleClass.autocorrectable === true
  }

  async processFiles(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {
    const jobs = context?.jobs ?? 1
    const shouldParallelize = jobs > 1 && files.length >= PARALLEL_FILE_THRESHOLD

    if (shouldParallelize) {
      return this.processFilesInParallel(files, jobs, formatOption, context)
    }

    return this.processFilesSequentially(files, formatOption, context)
  }

  private async processFilesSequentially(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {
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
      let customRules = undefined
      let customRuleInfo: Array<{ name: string, path: string }> = []
      let customRuleWarnings: string[] = []

      if (context?.loadCustomRules && !this.customRulesLoaded) {
        try {
          const result = await loadCustomRules({
            baseDir: context.projectPath,
            silent: formatOption === 'json'
          })

          customRules = result.rules
          customRuleInfo = result.ruleInfo
          customRuleWarnings = result.warnings

          this.customRulesLoaded = true

          if (customRules.length > 0 && formatOption !== 'json') {
            const ruleText = customRules.length === 1 ? 'rule' : 'rules'
            console.log(colorize(`\nLoaded ${customRules.length} custom ${ruleText}:`, "green"))

            for (const { name, path } of customRuleInfo) {
              const relativePath = context.projectPath ? path.replace(context.projectPath + '/', '') : path
              console.log(colorize(`  • ${name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
            }

            if (customRuleWarnings.length > 0) {
              console.log()
              for (const warning of customRuleWarnings) {
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

      this.linter = Linter.from(Herb, context?.config, customRules)
    }

    for (const filename of files) {
      const filePath = context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
      let content = readFileSync(filePath, "utf-8")

      const lintResult = this.linter.lint(content, {
        fileName: filename,
        ignoreDisableComments: context?.ignoreDisableComments
      })

      if (ruleCount === 0) {
        ruleCount = this.linter.getRuleCount()
      }

      if (context?.fix && lintResult.offenses.length > 0) {
        const autofixResult = this.linter.autofix(content, {
          fileName: filename,
          ignoreDisableComments: context?.ignoreDisableComments
        }, undefined, { includeUnsafe: context?.fixUnsafe })

        if (autofixResult.fixed.length > 0) {
          writeFileSync(filePath, autofixResult.source, "utf-8")

          filesFixed++

          if (formatOption !== 'json') {
            console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize(`Fixed ${autofixResult.fixed.length} ${autofixResult.fixed.length === 1 ? "offense" : "offenses"}`, "green")}`)
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
          totalInfo += autofixResult.unfixed.filter(offense => offense.severity === "info").length
          totalHints += autofixResult.unfixed.filter(offense => offense.severity === "hint").length
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
        totalInfo += lintResult.offenses.filter(o => o.severity === "info").length
        totalHints += lintResult.offenses.filter(o => o.severity === "hint").length
        filesWithOffenses++
      }
      totalIgnored += lintResult.ignored
      if (lintResult.wouldBeIgnored) {
        totalWouldBeIgnored += lintResult.wouldBeIgnored
      }
    }

    const result: ProcessingResult = {
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
      result.totalWouldBeIgnored = totalWouldBeIgnored
    }

    return result
  }

  private async processFilesInParallel(files: string[], jobs: number, formatOption: FormatOption, context?: ProcessingContext): Promise<ProcessingResult> {
    const workerCount = Math.min(jobs, files.length)
    const chunks = this.splitIntoChunks(files, workerCount)
    const workerPath = this.resolveWorkerPath()

    const workerPromises = chunks.map(chunk => this.runWorker(workerPath, chunk, context))
    const workerResults = await Promise.all(workerPromises)

    for (const result of workerResults) {
      if (result.error) {
        throw new Error(`Worker error: ${result.error}`)
      }
    }

    return this.aggregateWorkerResults(workerResults, formatOption, context)
  }

  private resolveWorkerPath(): string {
    try {
      const currentDir = dirname(fileURLToPath(import.meta.url))

      return join(currentDir, "lint-worker.js")
    } catch {
      return join(__dirname, "lint-worker.js")
    }
  }

  private splitIntoChunks(files: string[], chunkCount: number): string[][] {
    const chunks: string[][] = Array.from({ length: chunkCount }, () => [])

    for (let i = 0; i < files.length; i++) {
      chunks[i % chunkCount].push(files[i])
    }

    return chunks.filter(chunk => chunk.length > 0)
  }

  private runWorker(workerPath: string, files: string[], context?: ProcessingContext): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const workerData: WorkerInput = {
        files,
        projectPath: context?.projectPath || process.cwd(),
        configPath: context?.configPath,
        fix: context?.fix || false,
        fixUnsafe: context?.fixUnsafe || false,
        ignoreDisableComments: context?.ignoreDisableComments || false,
        loadCustomRules: context?.loadCustomRules || false,
      }

      const worker = new Worker(workerPath, { workerData })

      worker.on("message", (result: WorkerResult) => {
        resolve(result)
      })

      worker.on("error", (error) => {
        reject(error)
      })

      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`))
        }
      })
    })
  }

  private aggregateWorkerResults(results: WorkerResult[], formatOption: FormatOption, context?: ProcessingContext): ProcessingResult {
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

    for (const result of results) {
      totalErrors += result.totalErrors
      totalWarnings += result.totalWarnings
      totalInfo += result.totalInfo
      totalHints += result.totalHints
      totalIgnored += result.totalIgnored
      totalWouldBeIgnored += result.totalWouldBeIgnored
      filesWithOffenses += result.filesWithOffenses
      filesFixed += result.filesFixed

      if (result.ruleCount > 0) {
        ruleCount = result.ruleCount
      }

      for (const offense of result.offenses) {
        allOffenses.push({
          filename: offense.filename,
          offense: offense.offense,
          content: offense.content,
          autocorrectable: offense.autocorrectable
        })
      }

      for (const [rule, data] of result.ruleOffenses) {
        const existing = ruleOffenses.get(rule) || { count: 0, files: new Set<string>() }
        existing.count += data.count

        for (const file of data.files) {
          existing.files.add(file)
        }

        ruleOffenses.set(rule, existing)
      }

      if (formatOption !== 'json') {
        for (const fixMessage of result.fixMessages) {
          const [filename, countStr] = fixMessage.split("\t")
          const count = parseInt(countStr, 10)
          console.log(`${colorize("\u2713", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize(`Fixed ${count} ${count === 1 ? "offense" : "offenses"}`, "green")}`)
        }
      }
    }

    const processingResult: ProcessingResult = {
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
      processingResult.totalWouldBeIgnored = totalWouldBeIgnored
    }

    return processingResult
  }

  /**
   * Returns the default number of parallel jobs based on available CPU cores.
   * Returns 1 if parallelism detection fails.
   */
  static defaultJobs(): number {
    try {
      return availableParallelism()
    } catch {
      return 1
    }
  }
}
