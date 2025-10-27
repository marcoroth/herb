import { glob } from "glob"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

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

  protected determineProjectPath(pattern: string | undefined): void {
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

    let { pattern, configFile, formatOption, showTiming, theme, wrapLines, truncateLines, useGitHubActions, fix, ignoreDisableComments, force, init } = this.argumentParser.parse(process.argv)

    this.determineProjectPath(pattern)

    if (init) {
      const configPath = configFile || this.projectPath

      if (Config.exists(configPath)) {
        const fullPath = configFile || Config.configPathFromProjectPath(this.projectPath)
        console.error(`\n✗ Configuration file already exists at ${fullPath}`)
        console.error(`  Use --config-file to specify a different location.\n`)
        process.exit(1)
      }

      const config = await Config.load(configPath, { version, exitOnError: true, createIfMissing: true, silent: true })
      console.log(`\n✓ Configuration initialized at ${config.path}`)
      console.log(`  Edit this file to customize linter and formatter settings.\n`)
      process.exit(0)
    }

    const silent = formatOption === 'json'
    const config = await Config.load(configFile || this.projectPath, { version, exitOnError: true, createIfMissing: false, silent })
    const linterConfig = config.options.linter || {}
    const configGlobPattern = config.getGlobPattern('linter')

    pattern = this.adjustPattern(pattern, configGlobPattern)

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

      const files = await glob(pattern, {
        cwd: this.projectPath,
        ignore: config.getExcludePatterns('linter')
      })

      if (files.length === 0) {
        this.exitWithInfo(`No files found matching pattern: ${pattern}`, formatOption, 0, { startTime, startDate, showTiming })
      }

      const context: ProcessingContext = {
        projectPath: this.projectPath,
        pattern,
        fix,
        ignoreDisableComments,
        linterConfig,
        config
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
