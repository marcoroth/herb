import { glob } from "tinyglobby"
import { Herb } from "@herb-tools/node-wasm"
import { Config, addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "@herb-tools/config"

import { existsSync, statSync } from "fs"
import { resolve, relative } from "path"
import { colorize } from "@herb-tools/highlighter"

import { Linter } from "./linter.js"
import { rules } from "./rules.js"
import { ArgumentParser } from "./cli/argument-parser.js"
import { FileProcessor } from "./cli/file-processor.js"
import { OutputManager } from "./cli/output-manager.js"
import { version } from "../package.json"

import type { ProcessingContext } from "./cli/file-processor.js"
import type { FormatOption } from "./cli/argument-parser.js"

export * from "./cli/index.js"

export class CLI {
  protected argumentParser = new ArgumentParser()
  protected fileProcessor = new FileProcessor()
  protected outputManager = new OutputManager()
  protected projectPath: string = process.cwd()

  getProjectPath(): string {
    return this.projectPath
  }

  protected exitWithError(message: string, formatOption: FormatOption, exitCode: number = 1) {
    this.outputManager.outputError(message, {
      formatOption,
      theme: 'auto',
      wrapLines: false,
      truncateLines: false,
      showTiming: false,
      useGitHubActions: false,
      startTime: 0,
      startDate: new Date()
    })
    process.exit(exitCode)
  }

  protected exitWithInfo(message: string, formatOption: FormatOption, exitCode: number = 0, timingData?: { startTime: number, startDate: Date, showTiming: boolean }) {
    const outputOptions = {
      formatOption,
      theme: 'auto' as const,
      wrapLines: false,
      truncateLines: false,
      showTiming: timingData?.showTiming ?? false,
      useGitHubActions: false,
      startTime: timingData?.startTime ?? Date.now(),
      startDate: timingData?.startDate ?? new Date()
    }

    this.outputManager.outputInfo(message, outputOptions)
    process.exit(exitCode)
  }

  protected determineProjectPath(patterns: string[]): void {
    const pattern = patterns[0]
    if (pattern) {
      const resolvedPattern = resolve(pattern)

      if (existsSync(resolvedPattern)) {
        this.projectPath = Config.findProjectRootSync(resolvedPattern)
      }
    }
  }

  protected adjustPattern(pattern: string | undefined, configGlobPatterns: string[]): string {
    if (!pattern) {
      return configGlobPatterns.length === 1 ? configGlobPatterns[0] : `{${configGlobPatterns.join(',')}}`
    }

    const resolvedPattern = resolve(pattern)

    if (existsSync(resolvedPattern)) {
      const stats = statSync(resolvedPattern)

      if (stats.isDirectory()) {
        const relativeDir = relative(this.projectPath, resolvedPattern)

        if (relativeDir) {
          const scopedPatterns = configGlobPatterns.map(pattern => `${relativeDir}/${pattern}`)

          return scopedPatterns.length === 1 ? scopedPatterns[0] : `{${scopedPatterns.join(',')}}`
        }

        return configGlobPatterns.length === 1 ? configGlobPatterns[0] : `{${configGlobPatterns.join(',')}}`
      } else if (stats.isFile()) {
        return relative(this.projectPath, resolvedPattern)
      }
    }

    return pattern
  }

  protected async resolvePatternToFiles(pattern: string, config: Config, force: boolean): Promise<{ files: string[], explicitFile: string | undefined }> {
    const resolvedPattern = resolve(pattern)
    const isExplicitFile = existsSync(resolvedPattern) && statSync(resolvedPattern).isFile()
    let explicitFile: string | undefined

    if (isExplicitFile) {
      explicitFile = pattern
    }

    const filesConfig = config.getFilesConfigForTool('linter')
    const configGlobPatterns = filesConfig.include && filesConfig.include.length > 0
      ? filesConfig.include
      : ['**/*.html.erb']

    const adjustedPattern = this.adjustPattern(pattern, configGlobPatterns)

    let files = await glob(adjustedPattern, {
      cwd: this.projectPath,
      ignore: filesConfig.exclude || []
    })

    if (explicitFile && files.length === 0) {
      if (!force) {
        console.error(`⚠️  File ${explicitFile} is excluded by configuration patterns.`)
        console.error(`   Use --force to lint it anyway.\n`)
        process.exit(0)
      } else {
        console.log(`⚠️  Forcing linter on excluded file: ${explicitFile}`)
        console.log()
        files = [adjustedPattern]
      }
    }

    return { files, explicitFile }
  }

  protected async beforeProcess(): Promise<void> {
    // Hook for subclasses to add custom output before processing
  }

  protected async afterProcess(_results: any, _outputOptions: any): Promise<void> {
    // Hook for subclasses to add custom output after processing
  }

  async run() {
    await Herb.load()

    const startTime = Date.now()
    const startDate = new Date()

    const { patterns, configFile, formatOption, showTiming, theme, wrapLines, truncateLines, useGitHubActions, fix, fixUnsafe, ignoreDisableComments, force, init, upgrade, disableFailing, loadCustomRules, failLevel, jobs } = this.argumentParser.parse(process.argv)

    this.determineProjectPath(patterns)

    if (init) {
      const configPath = configFile || this.projectPath

      if (Config.exists(configPath)) {
        const fullPath = configFile || Config.configPathFromProjectPath(this.projectPath)
        console.error(`\n✗ Configuration file already exists at ${fullPath}`)
        console.error(`  Use --config-file to specify a different location.\n`)
        process.exit(1)
      }

      const config = await Config.loadForCLI(configPath, version, true)
      const extensionAdded = addHerbExtensionRecommendation(this.projectPath)

      console.log(`\n✓ Configuration initialized at ${config.path}`)

      if (extensionAdded) {
        console.log(`✓ VSCode extension recommended in ${getExtensionsJsonRelativePath()}`)
      }

      console.log(`  Edit this file to customize linter and formatter settings.\n`)
      process.exit(0)
    }

    if (upgrade) {
      const configPath = configFile || this.projectPath

      if (!Config.exists(configPath)) {
        console.error(`\n✗ No .herb.yml found. Run ${colorize("herb-lint --init", "cyan")} first.\n`)
        process.exit(1)
      }

      const config = await Config.load(configPath, { version, exitOnError: true, createIfMissing: false, silent: true })
      const configVersion = config.configVersion

      if (configVersion === version) {
        console.log(`\n✓ Your .herb.yml is already at version ${version}. Nothing to upgrade.\n`)
        process.exit(0)
      }

      const { skippedByVersion } = Linter.filterRulesByConfig(rules, config.linter?.rules, configVersion)

      let rulesToDisable: typeof skippedByVersion = []
      let rulesToEnable: typeof skippedByVersion = []
      const ruleOffenseCounts = new Map<string, number>()

      if (skippedByVersion.length > 0) {
        console.log(`\n${colorize("↻", "cyan")} Checking ${colorize(String(skippedByVersion.length), "bold")} new ${skippedByVersion.length === 1 ? "rule" : "rules"} against your codebase...`)

        const skippedRulesConfig: Record<string, { enabled: boolean }> = {}

        for (const rule of skippedByVersion) {
          skippedRulesConfig[rule.ruleName] = { enabled: true }
        }

        const upgradeConfig = Config.fromObject({
          ...config.options,
          linter: {
            ...config.options.linter,
            rules: { ...config.options.linter?.rules, ...skippedRulesConfig }
          }
        }, { projectPath: this.projectPath, configVersion: version })

        const upgradeContext: ProcessingContext = {
          projectPath: this.projectPath,
          config: upgradeConfig,
          jobs,
        }

        await Herb.load()

        const files = await config.findFilesForTool('linter', this.projectPath)
        const upgradeProcessor = new FileProcessor()
        const results = await upgradeProcessor.processFiles(files, 'json', upgradeContext)

        for (const { offense } of results.allOffenses) {
          if (offense.severity !== "error" && offense.severity !== "warning") continue

          const ruleName = offense.code || ""
          ruleOffenseCounts.set(ruleName, (ruleOffenseCounts.get(ruleName) || 0) + 1)
        }

        rulesToDisable = skippedByVersion.filter(rule => ruleOffenseCounts.has(rule.ruleName))
        rulesToEnable = skippedByVersion.filter(rule => !ruleOffenseCounts.has(rule.ruleName))

        const rulesMutation: Record<string, { enabled: boolean }> = {}

        for (const rule of rulesToDisable) {
          rulesMutation[rule.ruleName] = { enabled: false }
        }

        if (Object.keys(rulesMutation).length > 0) {
          await Config.mutateConfigFile(config.path, {
            linter: { rules: rulesMutation }
          })
        }
      }

      const { promises: fs } = await import("fs")
      let content = await fs.readFile(config.path, "utf-8")
      content = content.replace(/^version:\s*.+$/m, `version: ${version}`)
      await fs.writeFile(config.path, content, "utf-8")

      console.log(`\n${colorize("✓", "brightGreen")} Updated ${colorize(".herb.yml", "cyan")} version from ${colorize(configVersion, "cyan")} to ${colorize(version, "cyan")}`)

      if (rulesToEnable.length > 0) {
        console.log(`\n${colorize("✓", "brightGreen")} Enabled ${colorize(String(rulesToEnable.length), "bold")} new ${rulesToEnable.length === 1 ? "rule" : "rules"} (no offenses found):\n`)

        for (const rule of rulesToEnable) {
          console.log(`  ${colorize("✓", "brightGreen")} ${colorize(rule.ruleName, "white")}`)
        }
      }

      if (rulesToDisable.length > 0) {
        const totalOffenses = Array.from(ruleOffenseCounts.values()).reduce((sum, count) => sum + count, 0)

        console.log(`\n${colorize("!", "yellow")} Found ${colorize(String(totalOffenses), "bold")} ${totalOffenses === 1 ? "offense" : "offenses"} across ${colorize(String(rulesToDisable.length), "bold")} new ${rulesToDisable.length === 1 ? "rule" : "rules"}. Disabled to ease the upgrade:\n`)

        for (const rule of rulesToDisable) {
          const offenseCount = ruleOffenseCounts.get(rule.ruleName) || 0
          console.log(`  ${colorize("✗", "red")} ${colorize(rule.ruleName, "white")} ${colorize(`(${offenseCount} ${offenseCount === 1 ? "offense" : "offenses"})`, "gray")}`)
        }

        console.log(`\n  When you're ready, review the disabled ${rulesToDisable.length === 1 ? "rule" : "rules"} in your ${colorize(".herb.yml", "cyan")} and re-enable them after fixing the offenses.`)
      }

      if (skippedByVersion.length === 0) {
        console.log(`\n${colorize("✓", "brightGreen")} No new rules to configure.`)
      }

      console.log("")
      process.exit(0)
    }

    if (disableFailing) {
      const configPath = configFile || this.projectPath

      if (!Config.exists(configPath)) {
        console.error(`\n✗ No .herb.yml found. Run ${colorize("herb-lint --init", "cyan")} first.\n`)
        process.exit(1)
      }

      const config = await Config.load(configPath, { version, exitOnError: true, createIfMissing: false, silent: true })

      console.log(`\n${colorize("↻", "cyan")} Linting codebase to find rules with offenses...`)

      await Herb.load()

      const files = await config.findFilesForTool('linter', this.projectPath)

      const disableFailingContext: ProcessingContext = {
        projectPath: this.projectPath,
        config,
        jobs,
      }

      const processor = new FileProcessor()
      const results = await processor.processFiles(files, 'json', disableFailingContext)
      const failingRules = new Map<string, number>()
      const PROTECTED_RULES = new Set(["parser-no-errors"])

      for (const { offense } of results.allOffenses) {
        if (PROTECTED_RULES.has(offense.code || "")) continue
        if (offense.severity !== "error" && offense.severity !== "warning") continue

        failingRules.set(offense.code || "", (failingRules.get(offense.code || "") || 0) + 1)
      }

      if (failingRules.size === 0) {
        console.log(`\n${colorize("✓", "brightGreen")} No offenses found. All rules are passing!\n`)
        process.exit(0)
      }

      const rulesMutation: Record<string, { enabled: boolean }> = {}

      for (const ruleName of failingRules.keys()) {
        rulesMutation[ruleName] = { enabled: false }
      }

      await Config.mutateConfigFile(config.path, {
        linter: { rules: rulesMutation }
      })

      const totalOffenses = Array.from(failingRules.values()).reduce((sum, count) => sum + count, 0)
      const sortedRules = Array.from(failingRules.entries()).sort((a, b) => b[1] - a[1])

      console.log(`\n${colorize("!", "yellow")} Found ${colorize(String(totalOffenses), "bold")} ${totalOffenses === 1 ? "offense" : "offenses"} across ${colorize(String(failingRules.size), "bold")} ${failingRules.size === 1 ? "rule" : "rules"}. Disabled in ${colorize(".herb.yml", "cyan")}:\n`)

      for (const [ruleName, count] of sortedRules) {
        console.log(`  ${colorize("✗", "red")} ${colorize(ruleName, "white")} ${colorize(`(${count} ${count === 1 ? "offense" : "offenses"})`, "gray")}`)
      }

      console.log(`\n  When you're ready, review the disabled rules in your ${colorize(".herb.yml", "cyan")} and re-enable them after fixing the offenses.\n`)
      process.exit(0)
    }

    const silent = formatOption === 'json'
    const config = await Config.load(configFile || this.projectPath, { version, exitOnError: true, createIfMissing: false, silent })
    const linterConfig = config.options.linter || {}

    const outputOptions = {
      formatOption,
      theme,
      wrapLines,
      truncateLines,
      showTiming,
      useGitHubActions,
      startTime,
      startDate,
      toolVersion: version
    }

    try {
      await this.beforeProcess()

      if (linterConfig.enabled === false && !force) {
        this.exitWithInfo("Linter is disabled in .herb.yml configuration. Use --force to lint anyway.", formatOption, 0, { startTime, startDate, showTiming })
      }

      if (force && linterConfig.enabled === false) {
        console.log("⚠️  Forcing linter run (disabled in .herb.yml)")
        console.log()
      }

      let files: string[]
      const explicitFiles: string[] = []

      if (patterns.length === 0) {
        files = await config.findFilesForTool('linter', this.projectPath)
      } else {
        const allFiles: string[] = []

        for (const pattern of patterns) {
          const { files: patternFiles, explicitFile } = await this.resolvePatternToFiles(pattern, config, force)

          if (patternFiles.length === 0) {
            console.error(`✗ No files found matching pattern: ${pattern}`)
            process.exit(1)
          }

          allFiles.push(...patternFiles)
          if (explicitFile) {
            explicitFiles.push(explicitFile)
          }
        }

        files = [...new Set(allFiles)]
      }

      if (files.length === 0) {
        this.exitWithInfo(`No files found matching patterns: ${patterns.join(', ') || 'from config'}`, formatOption, 0, { startTime, startDate, showTiming })
      }

      let processingConfig = config

      if (force && explicitFiles.length > 0) {
        const modifiedConfig = Object.create(Object.getPrototypeOf(config))
        Object.assign(modifiedConfig, config)

        modifiedConfig.config = {
          ...config.config,
          linter: {
            ...config.config.linter,
            exclude: []
          }
        }

        processingConfig = modifiedConfig
      }

      const hasConfigFile = Config.exists(configFile || this.projectPath)

      const context: ProcessingContext = {
        projectPath: this.projectPath,
        configPath: configFile,
        pattern: patterns.join(' '),
        fix,
        fixUnsafe,
        ignoreDisableComments,
        linterConfig,
        config: processingConfig,
        hasConfigFile,
        loadCustomRules,
        jobs
      }

      const results = await this.fileProcessor.processFiles(files, formatOption, context)

      await this.outputManager.outputResults({ ...results, files }, outputOptions)

      if (!Config.exists(this.projectPath) && formatOption !== 'json' && !useGitHubActions) {
        console.log("")
        console.log(` ${colorize("TIP:", "bold")} Run ${colorize("herb-lint --init", "cyan")} to create a ${colorize(".herb.yml", "cyan")} and lock the ${colorize("version", "cyan")}.`)
        console.log(`      This ensures upgrading Herb won't enable new rules until you update the ${colorize("version", "cyan")} in ${colorize(".herb.yml", "cyan")}.`)
      }

      await this.afterProcess(results, outputOptions)

      const effectiveFailLevel = failLevel || linterConfig.failLevel

      const errors = results.totalErrors > 0
      const warnings = results.totalWarnings > 0
      const info = results.totalInfo > 0
      const hints = results.totalHints > 0

      const shouldFailOnWarnings = effectiveFailLevel === "warning" && warnings
      const shouldFailOnInfo = effectiveFailLevel === "info" && (warnings || info)
      const shouldFailOnHints = effectiveFailLevel === "hint" && (warnings || info || hints)

      const shouldFail = errors || shouldFailOnWarnings || shouldFailOnInfo || shouldFailOnHints

      if (shouldFail) {
        process.exit(1)
      }

    } catch (error) {
      this.exitWithError(`Error: ${error}`, formatOption)
    }
  }
}
