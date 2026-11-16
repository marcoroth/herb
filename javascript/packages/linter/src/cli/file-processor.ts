import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { Config } from "@herb-tools/config"
import { Worker } from "node:worker_threads"

import { rules } from "../rules.js"
import { loadCustomRules } from "../loader.js"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { availableParallelism } from "node:os"
import { colorize } from "@herb-tools/highlighter"
import { deserializeDiagnostic, didyoumean } from "@herb-tools/core"
import { fixabilityFor } from "../fixability.js"
import { buildPartialIndex, refreshPartialAfterFix } from "@herb-tools/analysis/node"
import { buildRenderGraph } from "@herb-tools/analysis/node"
import { isStructuredFormat } from "./output-format.js"
import { LintCache, customRuleFiles, processedFilesFrom, resolveCacheLocation, serializeOffense } from "./lint-cache.js"
import { version } from "../../package.json"

import type { Diagnostic } from "@herb-tools/core"
import type { AncestorChain } from "@herb-tools/analysis"
import type { FormatOption } from "./output-format.js"
import type { HerbConfigOptions } from "@herb-tools/config"
import type { WorkerInput, WorkerResult } from "./lint-worker.js"
import type { CachedFileResult } from "./lint-cache.js"
import type { Fixability } from "../fixability.js"
import type { VersionSkippedRule } from "../linter.js"
import type { LintOffense, RuleClass } from "../types.js"
import type { RenderGraph, PartialIndex } from "@herb-tools/analysis"

const AUTOMATIC_FIX_DIFF_LIMIT = 20

export interface ProcessedFile {
  filename: string
  offense: Diagnostic
  /** The call chain that justified the offense, when it came from where the file is rendered. */
  renderedFrom?: AncestorChain
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
  jobs?: number
  only?: string[]
  allRules?: boolean
  cache?: boolean
  cacheLocation?: string
}

type FileLintedCallback = (filename: string, result: CachedFileResult) => void

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
  totalCounterSuppressed?: number
  filesWithOffenses: number
  filesFixed: number
  ruleCount: number
  allOffenses: ProcessedFile[]
  ruleOffenses: Map<string, { count: number, files: Set<string> }>
  rulesSkippedByVersion: VersionSkippedRule[]
  rulesDisabledByConfig: number
  rulesNotEnabledByDefault: number
  context?: ProcessingContext
}

/**
 * Minimum number of files required to use parallel processing.
 * Below this threshold, sequential processing is faster due to
 * worker thread startup overhead (loading WASM, config, etc.).
 */
const PARALLEL_FILE_THRESHOLD = 10

/**
 * Upper bound for the default number of workers. Each worker loads its own
 * WASM parser and config, so on machines with many cores the startup cost of
 * one worker per core outweighs the extra parallelism.
 */
const MAX_DEFAULT_JOBS = 8

/**
 * Maximum Levenshtein distance for suggesting a rule name for an unknown rule.
 * Keeps typo suggestions while staying silent for names that aren't close to any rule.
 */
const SUGGESTION_DISTANCE_THRESHOLD = 8

export class FileProcessor {
  private linter: Linter | null = null
  private customRulesLoaded: boolean = false
  private customRules: RuleClass[] | undefined = undefined
  private partials: PartialIndex | undefined = undefined
  private partialCallers: RenderGraph | undefined = undefined
  private projectPath: string | undefined = undefined
  private cachedItems = new WeakSet<ProcessedFile>()
  private relintedOffenses = new Map<string, LintOffense[]>()

  /**
   * Loads the project's custom rules once and caches them for subsequent calls.
   */
  private async loadCustomRulesOnce(context?: ProcessingContext, formatOption: FormatOption = 'detailed'): Promise<RuleClass[] | undefined> {
    if (this.customRulesLoaded) return this.customRules
    if (!context?.loadCustomRules) return undefined

    try {
      const result = await loadCustomRules({
        baseDir: context.projectPath,
        silent: isStructuredFormat(formatOption)
      })

      this.customRules = result.rules

      if (result.rules.length > 0 && !isStructuredFormat(formatOption)) {
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
      if (!isStructuredFormat(formatOption)) {
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
    if (isStructuredFormat(formatOption)) return

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

      const offense = this.cachedItems.has(item) ? this.relintedOffense(item, content, context) : item.offense as LintOffense

      if (!offense) continue

      try {
        const result = this.linter.autofix(content, {
          fileName: item.filename,
          ignoreDisableComments: context?.ignoreDisableComments,
          
        }, [offense], { includeUnsafe: true })

        if (result.fixed.length > 0 && result.source !== content) {
          item.fixedContent = result.source
        }
      } catch {
        continue
      }
    }
  }

  /**
   * A cached offense has no `autofixContext`, since that holds AST nodes, so the fix preview
   * needs the same offense from a fresh lint of the file.
   */
  private relintedOffense(item: ProcessedFile, content: string, context?: ProcessingContext): LintOffense | undefined {
    let offenses = this.relintedOffenses.get(item.filename)

    if (!offenses) {
      offenses = this.linter!.lint(content, {
        fileName: item.filename,
        ignoreDisableComments: context?.ignoreDisableComments,
        partials: this.partials,
        partialCallers: this.partialCallers,
        projectPath: this.projectPath
      }).offenses

      this.relintedOffenses.set(item.filename, offenses)
    }

    const cached = item.offense as LintOffense

    return offenses.find(offense =>
      offense.rule === cached.rule &&
      offense.message === cached.message &&
      offense.location.toString() === cached.location.toString()
    )
  }

  private fixabilityFor(offense: LintOffense): Fixability {
    const ruleClass = this.linter?.rules.find(rule => rule.ruleName === offense.rule)

    return fixabilityFor(offense, ruleClass)
  }

  async processFiles(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {
    const jobs = context?.jobs ?? 1

    await this.buildPartialIndexOnce(context)

    if (!context?.cache) {
      const result = jobs > 1 && files.length >= PARALLEL_FILE_THRESHOLD
        ? await this.processFilesInParallel(files, jobs, formatOption, context)
        : await this.processFilesSequentially(files, formatOption, context)

      await this.attachFixPreviews(result.allOffenses, formatOption, context)

      return this.collapseOncePerRunOffenses(result)
    }

    return this.processFilesWithCache(files, jobs, formatOption, context)
  }

  /**
   * Lints only the files the cache has no result for, then merges in the cached results.
   *
   * Under `--fix`, a cached file with offenses is linted again so the fixer gets to run,
   * and a file the fixer rewrote is left out of the cache.
   */
  private async processFilesWithCache(files: string[], jobs: number, formatOption: FormatOption, context: ProcessingContext): Promise<ProcessingResult> {
    const cache = await this.openCache(formatOption, context)
    const keys = new Map<string, string>()
    const hits = new Map<string, CachedFileResult>()
    const misses: string[] = []

    for (const filename of files) {
      const key = cache.keyFor(filename, readFileSync(this.filePathFor(filename, context), "utf-8"))
      const hit = cache.get(filename, key)

      keys.set(filename, key)

      if (hit && !(context.fix && hit.offenses.length > 0)) {
        hits.set(filename, hit)
      } else {
        misses.push(filename)
      }
    }

    const onFileLinted: FileLintedCallback = (filename, result) => cache.set(filename, keys.get(filename)!, result)

    const result = jobs > 1 && misses.length >= PARALLEL_FILE_THRESHOLD
      ? await this.processFilesInParallel(misses, jobs, formatOption, context, onFileLinted)
      : await this.processFilesSequentially(misses, formatOption, context, onFileLinted, files.length)

    this.mergeCachedResults(result, hits, files.length, formatOption)

    const order = new Map(files.map((filename, index) => [filename, index]))
    result.allOffenses.sort((a, b) => order.get(a.filename)! - order.get(b.filename)!)

    await this.attachFixPreviews(result.allOffenses, formatOption, context)

    cache.save()

    return this.collapseOncePerRunOffenses(result)
  }

  private async openCache(formatOption: FormatOption, context: ProcessingContext): Promise<LintCache> {
    const projectPath = this.projectPath!
    const customRules = await this.loadCustomRulesOnce(context, formatOption)

    return LintCache.open(resolveCacheLocation(projectPath, context.cacheLocation), {
      projectPath,
      linterVersion: version,
      herbVersion: Herb.version,
      configOptions: context.config?.options,
      configVersion: context.config?.configVersion,
      only: context.only,
      allRules: context.allRules,
      ignoreDisableComments: context.ignoreDisableComments,
      customRuleFiles: customRules && customRules.length > 0 ? await customRuleFiles(projectPath) : [],
      partials: this.partials,
      partialCallers: this.partialCallers
    })
  }

  private mergeCachedResults(result: ProcessingResult, hits: Map<string, CachedFileResult>, fileCount: number, formatOption: FormatOption): void {
    for (const [filename, hit] of hits) {
      const offenses = processedFilesFrom(filename, hit)

      if (offenses.length === 0 && fileCount === 1 && !isStructuredFormat(formatOption)) {
        console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
      }

      for (const item of offenses) {
        const offense = item.offense as LintOffense

        if (offense.severity === "error") result.totalErrors++
        if (offense.severity === "warning") result.totalWarnings++
        if (offense.severity === "info") result.totalInfo++
        if (offense.severity === "hint") result.totalHints++

        const ruleData = result.ruleOffenses.get(offense.rule) || { count: 0, files: new Set() }
        ruleData.count++
        ruleData.files.add(filename)
        result.ruleOffenses.set(offense.rule, ruleData)
      }

      if (offenses.length > 0) result.filesWithOffenses++

      for (const item of offenses) this.cachedItems.add(item)

      result.allOffenses.push(...offenses)
      result.totalIgnored += hit.ignored

      if (hit.wouldBeIgnored > 0) result.totalWouldBeIgnored = (result.totalWouldBeIgnored ?? 0) + hit.wouldBeIgnored
      if (hit.counterSuppressed > 0) result.totalCounterSuppressed = (result.totalCounterSuppressed ?? 0) + hit.counterSuppressed
    }
  }

  private filePathFor(filename: string, context?: ProcessingContext): string {
    return context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
  }

  private collapseOncePerRunOffenses(result: ProcessingResult): ProcessingResult {
    const oncePerRun = new Set(rules.filter(rule => rule.reportsOncePerRun === true).map(rule => rule.ruleName))

    if (oncePerRun.size === 0) return result

    const seen = new Set<string>()
    const dropped: ProcessedFile[] = []

    result.allOffenses = result.allOffenses.filter(item => {
      const rule = (item.offense as LintOffense).rule

      if (!oncePerRun.has(rule)) return true
      if (!seen.has(rule)) {
        seen.add(rule)

        return true
      }

      dropped.push(item)

      return false
    })

    if (dropped.length === 0) return result

    const remainingFiles = new Set(result.allOffenses.map(item => item.filename))

    for (const item of dropped) {
      const severity = (item.offense as LintOffense).severity

      if (severity === "error") result.totalErrors--
      if (severity === "warning") result.totalWarnings--
      if (severity === "info") result.totalInfo--
      if (severity === "hint") result.totalHints--

      const ruleData = result.ruleOffenses.get((item.offense as LintOffense).rule)

      if (ruleData) {
        ruleData.count--
        ruleData.files.delete(item.filename)
      }
    }

    const droppedFiles = new Set(dropped.map(item => item.filename))

    for (const filename of droppedFiles) {
      if (!remainingFiles.has(filename)) result.filesWithOffenses--
    }

    return result
  }

  private async buildPartialIndexOnce(context?: ProcessingContext): Promise<void> {
    if (this.partials) return

    const projectPath = context?.projectPath || process.cwd()

    this.projectPath = projectPath

    try {
      this.partials = await buildPartialIndex(Herb, projectPath)
    } catch {
      this.partials = undefined
    }

    if (!this.partials) return

    try {
      this.partialCallers = await buildRenderGraph(Herb, projectPath, this.partials)
    } catch {
      this.partialCallers = undefined
    }
  }

  private async processFilesSequentially(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext, onFileLinted?: FileLintedCallback, totalFileCount: number = files.length): Promise<ProcessingResult> {
    let totalErrors = 0
    let totalWarnings = 0
    let totalInfo = 0
    let totalHints = 0
    let totalIgnored = 0
    let totalWouldBeIgnored = 0
    let totalCounterSuppressed = 0
    let filesWithOffenses = 0
    let filesFixed = 0
    let ruleCount = 0

    const allOffenses: ProcessedFile[] = []
    const ruleOffenses = new Map<string, { count: number, files: Set<string> }>()

    if (!this.linter) {
      const customRules = await this.loadCustomRulesOnce(context, formatOption)

      this.linter = Linter.from(Herb, context?.config, customRules, { only: context?.only, all: context?.allRules })
    }

    ruleCount = this.linter.getRuleCount()

    for (const filename of files) {
      const filePath = this.filePathFor(filename, context)
      const content = readFileSync(filePath, "utf-8")
      const fileOffenses: ProcessedFile[] = []
      let fileFixed = false

      const lintResult = this.linter.lint(content, {
        fileName: filename,
        ignoreDisableComments: context?.ignoreDisableComments,
        
        partials: this.partials,
        partialCallers: this.partialCallers,
        projectPath: this.projectPath
      })

      if (context?.fix && lintResult.offenses.length > 0) {
        const autofixResult = this.linter.autofix(content, {
          fileName: filename,
          ignoreDisableComments: context?.ignoreDisableComments,
          
          partials: this.partials,
          partialCallers: this.partialCallers,
          projectPath: this.projectPath
        }, lintResult.offenses, { includeUnsafe: context?.fixUnsafe })

        if (autofixResult.fixed.length > 0) {
          writeFileSync(filePath, autofixResult.source, "utf-8")

          refreshPartialAfterFix(Herb, this.partials, filename, content, autofixResult.source)

          filesFixed++
          fileFixed = true

          if (!isStructuredFormat(formatOption)) {
            console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize(`Fixed ${autofixResult.fixed.length} ${autofixResult.fixed.length === 1 ? "offense" : "offenses"}`, "green")}`)
          }
        }

        for (const offense of autofixResult.unfixed) {
          fileOffenses.push({
            filename,
            offense: offense,
            renderedFrom: offense.renderedFrom,
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
        if (totalFileCount === 1 && !isStructuredFormat(formatOption)) {
          console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize("No issues found", "green")}`)
        }
      } else {
        for (const offense of lintResult.offenses) {
          fileOffenses.push({
            filename,
            offense: offense,
            renderedFrom: offense.renderedFrom,
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
      if (lintResult.counterSuppressed) {
        totalCounterSuppressed += lintResult.counterSuppressed
      }

      allOffenses.push(...fileOffenses)

      if (onFileLinted && !fileFixed) {
        onFileLinted(filename, {
          offenses: fileOffenses.map(item => ({
            offense: serializeOffense(item.offense as LintOffense),
            renderedFrom: item.renderedFrom,
            autocorrectable: item.autocorrectable ?? false,
            unsafeAutocorrectable: item.unsafeAutocorrectable ?? false
          })),
          ignored: lintResult.ignored,
          wouldBeIgnored: lintResult.wouldBeIgnored ?? 0,
          counterSuppressed: lintResult.counterSuppressed ?? 0
        })
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
      rulesSkippedByVersion: this.linter?.rulesSkippedByVersion ?? [],
      rulesDisabledByConfig: this.linter?.rulesDisabledByConfig ?? 0,
      rulesNotEnabledByDefault: this.linter?.rulesNotEnabledByDefault ?? 0,
      context
    }

    if (totalWouldBeIgnored > 0) {
      result.totalWouldBeIgnored = totalWouldBeIgnored
    }

    if (totalCounterSuppressed > 0) {
      result.totalCounterSuppressed = totalCounterSuppressed
    }

    return result
  }

  private async processFilesInParallel(files: string[], jobs: number, formatOption: FormatOption, context?: ProcessingContext, onFileLinted?: FileLintedCallback): Promise<ProcessingResult> {
    const workerCount = Math.min(jobs, files.length)
    const chunks = this.splitIntoChunks(files, workerCount)
    const workerPath = this.resolveWorkerPath()

    const configVersion = context?.config?.configVersion
    const filterResult = Linter.filterRulesByConfig(rules, context?.config?.linter?.rules, configVersion, { only: context?.only, all: context?.allRules })

    const workerPromises = chunks.map(chunk => this.runWorker(workerPath, chunk, context, onFileLinted !== undefined))
    const workerResults = await Promise.all(workerPromises)

    for (const result of workerResults) {
      if (result.error) {
        throw new Error(`Worker error: ${result.error}`)
      }
    }

    const aggregated = this.aggregateWorkerResults(workerResults, formatOption, context)
    aggregated.rulesSkippedByVersion = filterResult.skippedByVersion
    aggregated.rulesDisabledByConfig = filterResult.disabledByConfig
    aggregated.rulesNotEnabledByDefault = filterResult.notEnabledByDefault

    if (onFileLinted) {
      for (const result of workerResults) {
        for (const [filename, fileResult] of result.fileResults) {
          onFileLinted(filename, fileResult)
        }
      }
    }

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

  private runWorker(workerPath: string, files: string[], context?: ProcessingContext, collectFileResults: boolean = false): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const workerData: WorkerInput = {
        files,
        projectPath: context?.projectPath || process.cwd(),
        configPath: context?.configPath,
        fix: context?.fix || false,
        fixUnsafe: context?.fixUnsafe || false,
        ignoreDisableComments: context?.ignoreDisableComments || false,
        
        loadCustomRules: context?.loadCustomRules || false,
        only: context?.only,
        allRules: context?.allRules || false,
        partials: this.partials?.toJSON(),
        partialCallers: this.partialCallers?.toJSON(),
        collectFileResults,
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
    let totalCounterSuppressed = 0
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
      totalCounterSuppressed += result.totalCounterSuppressed
      filesWithOffenses += result.filesWithOffenses
      filesFixed += result.filesFixed

      if (result.ruleCount > 0) {
        ruleCount = result.ruleCount
      }

      for (const offense of result.offenses) {
        allOffenses.push({
          filename: offense.filename,
          offense: deserializeDiagnostic(offense.offense),
          renderedFrom: offense.renderedFrom,
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

      if (!isStructuredFormat(formatOption)) {
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
      rulesSkippedByVersion: [],
      rulesDisabledByConfig: 0,
      rulesNotEnabledByDefault: 0,
      context
    }

    if (totalWouldBeIgnored > 0) {
      processingResult.totalWouldBeIgnored = totalWouldBeIgnored
    }

    if (totalCounterSuppressed > 0) {
      processingResult.totalCounterSuppressed = totalCounterSuppressed
    }

    return processingResult
  }

  /**
   * Returns the default number of parallel jobs based on available CPU cores,
   * capped at MAX_DEFAULT_JOBS. Returns 1 if parallelism detection fails.
   */
  static defaultJobs(): number {
    try {
      return Math.min(availableParallelism(), MAX_DEFAULT_JOBS)
    } catch {
      return 1
    }
  }
}
