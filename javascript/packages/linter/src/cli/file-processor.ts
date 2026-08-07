import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { ComparisonProgress } from "../backend-comparison.js"

import { Config } from "@herb-tools/config"
import { Worker } from "node:worker_threads"

import { rules } from "../rules.js"
import { loadCustomRules } from "../loader.js"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { availableParallelism, totalmem } from "node:os"
import { colorize } from "@herb-tools/highlighter"
import { deserializeDiagnostic, didyoumean } from "@herb-tools/core"
import { fixabilityFor } from "../fixability.js"
import { compareBackendOffenses } from "../backend-comparison.js"
import { buildPartialIndex, refreshPartialAfterFix } from "../partial-index-builder.js"

import type { Diagnostic } from "@herb-tools/core"
import type { FormatOption } from "./argument-parser.js"
import type { HerbConfigOptions } from "@herb-tools/config"
import type { BackendMismatch } from "../backend-comparison.js"
import type { WorkerInput, WorkerResult } from "./lint-worker.js"
import type { Fixability } from "../fixability.js"
import type { VersionSkippedRule } from "../linter.js"
import type { LintOffense, RuleClass } from "../types.js"
import type { PartialIndex } from "@herb-tools/core"

const AUTOMATIC_FIX_DIFF_LIMIT = 20

export interface ProcessedFile {
  filename: string
  offense: Diagnostic
  content?: string
  autocorrectable?: boolean
  unsafeAutocorrectable?: boolean
  fixedContent?: string
}

export interface ProcessingContext {
  projectPath?: string
  configPath?: string
  pattern?: string
  fix?: boolean
  fixUnsafe?: boolean
  ignoreDisableComments?: boolean
  showFixDiff?: boolean
  linterConfig?: HerbConfigOptions['linter']
  config?: Config
  hasConfigFile?: boolean
  loadCustomRules?: boolean
  compareBackends?: boolean
  backend?: "javascript" | "rust"
  allRules?: boolean
  jobs?: number
  only?: string[]
}

export interface UnknownRule {
  name: string
  suggestion?: string
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
  backendMismatches?: BackendMismatch[]
  rulesSkippedByVersion: VersionSkippedRule[]
  rulesDisabledByConfig: number
  rulesNotEnabledByDefault: number
  context?: ProcessingContext
}

const PARALLEL_FILE_THRESHOLD = 10
const RESERVED_MEMORY_FRACTION = 0.3
const MIN_WORKER_MEMORY_MB = 512
const MAX_WORKER_MEMORY_MB = 8192

export function workerMemoryLimitMb(workerCount: number, totalMemoryBytes: number = totalmem()): number {
  const override = Number(process.env.HERB_WORKER_MEMORY_MB)

  if (Number.isFinite(override) && override > 0) return Math.floor(override)

  const totalMb = totalMemoryBytes / 1024 / 1024
  const share = (totalMb * (1 - RESERVED_MEMORY_FRACTION)) / Math.max(1, workerCount)

  return Math.max(MIN_WORKER_MEMORY_MB, Math.min(MAX_WORKER_MEMORY_MB, Math.floor(share)))
}

/**
 * Maximum Levenshtein distance for suggesting a rule name for an unknown rule.
 * Keeps typo suggestions while staying silent for names that aren't close to any rule.
 */
const SUGGESTION_DISTANCE_THRESHOLD = 8

export class FileProcessor {
  private linter: Linter | null = null
  private rustLinter: Linter | null = null
  private customRulesLoaded: boolean = false
  private customRules: RuleClass[] | undefined = undefined
  private partials: PartialIndex | undefined = undefined

  /**
   * Loads the project's custom rules once and caches them for subsequent calls.
   */
  private async loadCustomRulesOnce(context?: ProcessingContext, formatOption: FormatOption = 'detailed'): Promise<RuleClass[] | undefined> {
    if (this.customRulesLoaded) return this.customRules
    if (!context?.loadCustomRules) return undefined

    try {
      const result = await loadCustomRules({
        baseDir: context.projectPath,
        silent: formatOption === 'json'
      })

      this.customRules = result.rules

      if (result.rules.length > 0 && formatOption !== 'json') {
        const ruleText = result.rules.length === 1 ? 'rule' : 'rules'
        console.log(colorize(`\nLoaded ${result.rules.length} custom ${ruleText}:`, "green"))

        for (const { name, path } of result.ruleInfo) {
          const relativePath = context.projectPath ? path.replace(context.projectPath + '/', '') : path
          console.log(colorize(`  • ${name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
        }

        if (result.warnings.length > 0) {
          console.log()

          for (const warning of result.warnings) {
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

    this.customRulesLoaded = true

    return this.customRules
  }

  /**
   * Returns the rule names from the given list that don't match any built-in or custom rule,
   * along with a suggestion for the closest matching rule name when there is one.
   *
   * @param additionalRuleNames - Rule names provided by a CLI on top of the built-in rules (e.g. Stimulus rules)
   */
  async findUnknownRules(ruleNames: string[], context?: ProcessingContext, formatOption: FormatOption = 'detailed', additionalRuleNames: string[] = []): Promise<UnknownRule[]> {
    const customRules = await this.loadCustomRulesOnce(context, formatOption)
    const availableRuleNames = [...rules, ...(customRules || [])].map(ruleClass => ruleClass.ruleName).concat(additionalRuleNames)

    return ruleNames
      .filter(ruleName => !availableRuleNames.includes(ruleName))
      .map(ruleName => ({ name: ruleName, suggestion: this.suggestRuleName(ruleName, availableRuleNames) }))
  }

  /**
   * Suggests the closest matching rule name for a rule name that doesn't exist.
   * Prefers rule names that contain (or are contained in) the given name, so partial
   * names like `erb-no-silent` suggest `erb-no-silent-statement`. Names that are too
   * far off don't get a suggestion at all.
   */
  private suggestRuleName(ruleName: string, availableRuleNames: string[]): string | undefined {
    const partialMatches = availableRuleNames
      .filter(availableRuleName => availableRuleName.includes(ruleName) || ruleName.includes(availableRuleName))
      .sort((a, b) => a.length - b.length)

    if (partialMatches.length > 0) return partialMatches[0]

    return didyoumean(ruleName, availableRuleNames, SUGGESTION_DISTANCE_THRESHOLD) ?? undefined
  }

  private async attachFixPreviews(allOffenses: ProcessedFile[], formatOption: FormatOption, context?: ProcessingContext): Promise<void> {
    if (formatOption === "json") return

    const correctable = allOffenses.filter(item => item.autocorrectable || item.unsafeAutocorrectable)

    if (correctable.length === 0) return
    if (!context?.showFixDiff && correctable.length > AUTOMATIC_FIX_DIFF_LIMIT) return

    if (!this.linter) {
      const customRules = await this.loadCustomRulesOnce(context, formatOption)

      this.linter = Linter.from(Herb, context?.config, customRules, { only: context?.only, all: context?.allRules })
    }

    const contents = new Map<string, string>()

    for (const item of correctable) {
      if (!contents.has(item.filename)) {
        const filePath = context?.projectPath ? resolve(context.projectPath, item.filename) : resolve(item.filename)

        try {
          contents.set(item.filename, item.content ?? readFileSync(filePath, "utf-8"))
        } catch {
          continue
        }
      }

      const content = contents.get(item.filename)

      if (content === undefined) continue

      try {
        const result = this.linter.autofix(content, {
          fileName: item.filename,
          ignoreDisableComments: context?.ignoreDisableComments,
        }, [item.offense as LintOffense], { includeUnsafe: true })

        if (result.fixed.length > 0 && result.source !== content) {
          item.fixedContent = result.source
        }
      } catch {
        continue
      }
    }
  }

  private fixabilityFor(offense: LintOffense): Fixability {
    const ruleClass = this.linter?.rules.find(rule => rule.ruleName === offense.rule)

    return fixabilityFor(offense, ruleClass)
  }

  async processFiles(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {
    const jobs = context?.jobs ?? 1
    const shouldParallelize = jobs > 1 && files.length >= PARALLEL_FILE_THRESHOLD

    await this.buildPartialIndexOnce(context)

    if (shouldParallelize) {
      return this.processFilesInParallel(files, jobs, formatOption, context)
    }

    return this.processFilesSequentially(files, formatOption, context)
  }

  private async buildPartialIndexOnce(context?: ProcessingContext): Promise<void> {
    if (this.partials) return

    try {
      this.partials = await buildPartialIndex(Herb, context?.projectPath || process.cwd())
    } catch {
      this.partials = undefined
    }
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
    const backendMismatches: BackendMismatch[] = []

    const buildLinter = async () =>
      Linter.from(Herb, context?.config, await this.loadCustomRulesOnce(context, formatOption), { only: context?.only, all: context?.allRules })

    if (!this.linter) {
      this.linter = await buildLinter()

      if (context?.backend) {
        this.linter.backendMode = context.backend
      }
    }

    const shouldCompare = context?.compareBackends && Herb.supportsLint
    const progress = shouldCompare ? new ComparisonProgress(files.length) : undefined

    if (shouldCompare && !this.rustLinter) {
      this.rustLinter = await buildLinter()
      this.rustLinter.backendMode = "rust"
    }

    for (const filename of files) {
      const filePath = context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
      let content = readFileSync(filePath, "utf-8")
      const originalContent = content

      const lintResult = this.linter.lint(content, {
        fileName: filename,
        ignoreDisableComments: context?.ignoreDisableComments,
        partials: this.partials
      })

      if (ruleCount === 0) {
        ruleCount = this.linter.getRuleCount()
      }

      if (context?.fix && lintResult.offenses.length > 0) {
        const autofixResult = this.linter.autofix(content, {
          fileName: filename,
          ignoreDisableComments: context?.ignoreDisableComments,
          partials: this.partials
        }, undefined, { includeUnsafe: context?.fixUnsafe })

        if (autofixResult.fixed.length > 0) {
          writeFileSync(filePath, autofixResult.source, "utf-8")

          refreshPartialAfterFix(Herb, this.partials, filename, content, autofixResult.source)

          filesFixed++

          if (formatOption !== 'json') {
            console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize(`Fixed ${autofixResult.fixed.length} ${autofixResult.fixed.length === 1 ? "offense" : "offenses"}`, "green")}`)
          }
        }

        for (const offense of autofixResult.unfixed) {
          allOffenses.push({
            filename,
            offense: offense,
            ...this.fixabilityFor(offense)
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
            ...this.fixabilityFor(offense)
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

      if (shouldCompare && this.rustLinter) {
        progress?.advance()

        const rustResult = this.rustLinter.lint(originalContent, {
          fileName: filename,
          ignoreDisableComments: context?.ignoreDisableComments,
          partials: this.partials
        })

        const mismatch = compareBackendOffenses(filename, lintResult.offenses, rustResult.offenses)
        if (mismatch) {
          backendMismatches.push(mismatch)
        }
      }
    }

    progress?.finish()

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
      backendMismatches: shouldCompare ? backendMismatches : undefined,
      rulesSkippedByVersion: this.linter?.rulesSkippedByVersion ?? [],
      rulesDisabledByConfig: this.linter?.rulesDisabledByConfig ?? 0,
      rulesNotEnabledByDefault: this.linter?.rulesNotEnabledByDefault ?? 0,
      context
    }

    if (totalWouldBeIgnored > 0) {
      result.totalWouldBeIgnored = totalWouldBeIgnored
    }

    await this.attachFixPreviews(allOffenses, formatOption, context)

    return result
  }

  private async processFilesInParallel(files: string[], jobs: number, formatOption: FormatOption, context?: ProcessingContext): Promise<ProcessingResult> {
    const workerCount = Math.min(jobs, files.length)
    const chunks = this.splitIntoChunks(files, workerCount)
    const workerPath = this.resolveWorkerPath()

    const configVersion = context?.config?.configVersion
    const filterResult = Linter.filterRulesByConfig(rules, context?.config?.linter?.rules, configVersion, { only: context?.only, all: context?.allRules })

    const progress = context?.compareBackends && Herb.supportsLint ? new ComparisonProgress(files.length) : undefined
    const memoryLimitMb = workerMemoryLimitMb(workerCount)
    const workerPromises = chunks.map(chunk => this.runWorker(workerPath, chunk, context, count => progress?.advance(count), memoryLimitMb))
    const workerResults = await Promise.all(workerPromises)

    progress?.finish()

    for (const result of workerResults) {
      if (result.error) {
        throw new Error(`Worker error: ${result.error}`)
      }
    }

    const aggregated = this.aggregateWorkerResults(workerResults, formatOption, context)

    aggregated.rulesSkippedByVersion = context?.allRules ? [] : filterResult.skippedByVersion
    aggregated.rulesDisabledByConfig = context?.allRules ? 0 : filterResult.disabledByConfig
    aggregated.rulesNotEnabledByDefault = context?.allRules ? 0 : filterResult.notEnabledByDefault

    await this.attachFixPreviews(aggregated.allOffenses, formatOption, context)

    return aggregated
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

  private runWorker(workerPath: string, files: string[], context?: ProcessingContext, onProgress?: (count: number) => void, memoryLimitMb: number = workerMemoryLimitMb(1)): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const workerData: WorkerInput = {
        files,
        projectPath: context?.projectPath || process.cwd(),
        configPath: context?.configPath,
        fix: context?.fix || false,
        fixUnsafe: context?.fixUnsafe || false,
        ignoreDisableComments: context?.ignoreDisableComments || false,
        loadCustomRules: context?.loadCustomRules || false,
        backendMode: context?.backend,
        only: context?.only,
        allRules: context?.allRules || false,
        compareBackends: context?.compareBackends || false,
        partials: this.partials?.toJSON(),
      }

      const workerMemoryMb = Number(process.env.HERB_WORKER_MEMORY_MB) || 4096

      const worker = new Worker(workerPath, {
        workerData,
        resourceLimits: { maxOldGenerationSizeMb: workerMemoryMb }
      })

      worker.on("message", (message: WorkerResult | { progress: number }) => {
        if (typeof (message as { progress?: number }).progress === "number") {
          onProgress?.((message as { progress: number }).progress)
          return
        }

        resolve(message as WorkerResult)
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
    const backendMismatches: BackendMismatch[] = []
    let comparedBackends = false

    for (const result of results) {
      if (result.backendMismatches !== undefined) {
        comparedBackends = true
        backendMismatches.push(...result.backendMismatches)
      }

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
          offense: deserializeDiagnostic(offense.offense),
          autocorrectable: offense.autocorrectable,
          unsafeAutocorrectable: offense.unsafeAutocorrectable
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
      backendMismatches: comparedBackends ? backendMismatches : undefined,
      rulesSkippedByVersion: [],
      rulesDisabledByConfig: 0,
      rulesNotEnabledByDefault: 0,
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
