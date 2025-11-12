import { glob } from "glob"
import { Herb } from "@herb-tools/node-wasm"
import { Config, addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "@herb-tools/config"

import { existsSync, statSync } from "fs"
import { dirname, resolve, relative } from "path"

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
        const stats = statSync(resolvedPattern)

        if (stats.isDirectory()) {
          this.projectPath = resolvedPattern
        } else {
          this.projectPath = dirname(resolvedPattern)
        }
      }
    }
  }

  protected adjustPattern(pattern: string | undefined, configGlobPattern: string): string {
    if (!pattern) {
      return configGlobPattern
    }

    const resolvedPattern = resolve(pattern)

    if (existsSync(resolvedPattern)) {
      const stats = statSync(resolvedPattern)

      if (stats.isDirectory()) {
        return configGlobPattern
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
    const configGlobPattern = filesConfig.include && filesConfig.include.length > 0
      ? (filesConfig.include.length === 1 ? filesConfig.include[0] : `{${filesConfig.include.join(',')}}`)
      : '**/*.html.erb'
    const adjustedPattern = this.adjustPattern(pattern, configGlobPattern)

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

    let { patterns, configFile, formatOption, showTiming, theme, wrapLines, truncateLines, useGitHubActions, fix, ignoreDisableComments, force, init, loadCustomRules } = this.argumentParser.parse(process.argv)

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
      startDate
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
      let explicitFiles: string[] = []

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

      const context: ProcessingContext = {
        projectPath: this.projectPath,
        pattern: patterns.join(' '),
        fix,
        ignoreDisableComments,
        linterConfig,
        config: processingConfig,
        loadCustomRules
      }

      const results = await this.fileProcessor.processFiles(files, formatOption, context)

      await this.outputManager.outputResults({ ...results, files }, outputOptions)
      await this.afterProcess(results, outputOptions)

      if (results.totalErrors > 0) {
        process.exit(1)
      }

    } catch (error) {
      this.exitWithError(`Error: ${error}`, formatOption)
    }
  }
}
