import { glob } from "glob"
import { Herb } from "@herb-tools/node-wasm"
import { existsSync, statSync } from "fs"
import { dirname, resolve, relative } from "path"

import { ArgumentParser, type FormatOption } from "./cli/argument-parser.js"
import { FileProcessor } from "./cli/file-processor.js"
import { OutputManager } from "./cli/output-manager.js"

export * from "./cli/index.js"

export class CLI {
  protected argumentParser = new ArgumentParser()
  protected fileProcessor = new FileProcessor()
  protected outputManager = new OutputManager()
  protected projectPath: string = process.cwd()

  getProjectPath(): string {
    return this.projectPath
  }

  protected findProjectRoot(startPath: string): string {
    let currentPath = resolve(startPath)

    if (existsSync(currentPath) && statSync(currentPath).isFile()) {
      currentPath = dirname(currentPath)
    }

    const projectIndicators = [
      'package.json',
      'Gemfile',
      '.git',
      'tsconfig.json',
      'composer.json',
      'pyproject.toml',
      'requirements.txt',
      '.herb.yml'
    ]

    while (currentPath !== '/') {
      for (const indicator of projectIndicators) {
        if (existsSync(resolve(currentPath, indicator))) {
          return currentPath
        }
      }

      const parentPath = dirname(currentPath)
      if (parentPath === currentPath) {
        break
      }

      currentPath = parentPath
    }

    return existsSync(startPath) && statSync(startPath).isDirectory()
      ? startPath
      : dirname(startPath)
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
          this.projectPath = this.findProjectRoot(resolvedPattern)
        }
      }
    }
  }

  protected adjustPattern(pattern: string | undefined): string {
    if (!pattern) {
      return '**/*.html.erb'
    }

    const resolvedPattern = resolve(pattern)

    if (existsSync(resolvedPattern)) {
      const stats = statSync(resolvedPattern)

      if (stats.isDirectory()) {
        return '**/*.html.erb'
      } else if (stats.isFile()) {
        return relative(this.projectPath, resolvedPattern)
      }
    }

    return pattern
  }

  protected async beforeProcess(): Promise<void> {
    await Herb.load()
  }

  protected async afterProcess(_results: any, _outputOptions: any): Promise<void> {
    // Hook for subclasses to add custom output after processing
  }

  async run() {
    const startTime = Date.now()
    const startDate = new Date()

    let { pattern, formatOption, showTiming, theme, wrapLines, truncateLines, useGitHubActions } = this.argumentParser.parse(process.argv)

    this.determineProjectPath(pattern)

    pattern = this.adjustPattern(pattern)

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

      const files = await glob(pattern, { cwd: this.projectPath })

      if (files.length === 0) {
        this.exitWithInfo(`No files found matching pattern: ${pattern}`, formatOption, 0, { startTime, startDate, showTiming })
      }

      const context = {
        projectPath: this.projectPath,
        pattern: pattern
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
