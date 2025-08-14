import { glob } from "glob"
import { Herb } from "@herb-tools/node-wasm"
import { ArgumentParser, type FormatOption } from "./cli/argument-parser.js"
import { FileProcessor } from "./cli/file-processor.js"
import { OutputManager } from "./cli/output-manager.js"

export class CLI {
  private argumentParser = new ArgumentParser()
  private fileProcessor = new FileProcessor()
  private outputManager = new OutputManager()

  private exitWithError(message: string, formatOption: FormatOption, exitCode: number = 1) {
    this.outputManager.outputError(message, { 
      formatOption, 
      theme: 'auto', 
      wrapLines: false, 
      truncateLines: false, 
      showTiming: false, 
      startTime: 0, 
      startDate: new Date() 
    })
    process.exit(exitCode)
  }

  private exitWithInfo(message: string, formatOption: FormatOption, exitCode: number = 0, timingData?: { startTime: number, startDate: Date, showTiming: boolean }) {
    const outputOptions = {
      formatOption,
      theme: 'auto' as const,
      wrapLines: false,
      truncateLines: false,
      showTiming: timingData?.showTiming ?? false,
      startTime: timingData?.startTime ?? Date.now(),
      startDate: timingData?.startDate ?? new Date()
    }
    
    this.outputManager.outputInfo(message, outputOptions)
    process.exit(exitCode)
  }

  async run() {
    const startTime = Date.now()
    const startDate = new Date()

    const { pattern, formatOption, showTiming, theme, wrapLines, truncateLines } = this.argumentParser.parse(process.argv)

    const outputOptions = {
      formatOption,
      theme,
      wrapLines,
      truncateLines,
      showTiming,
      startTime,
      startDate
    }

    try {
      await Herb.load()

      const files = await glob(pattern)

      if (files.length === 0) {
        this.exitWithInfo(`No files found matching pattern: ${pattern}`, formatOption, 0, { startTime, startDate, showTiming })
      }

      const results = await this.fileProcessor.processFiles(files, formatOption)
      
      await this.outputManager.outputResults({ ...results, files }, outputOptions)

      if (results.totalErrors > 0) {
        process.exit(1)
      }

    } catch (error) {
      this.exitWithError(`Error: ${error}`, formatOption)
    }
  }
}
