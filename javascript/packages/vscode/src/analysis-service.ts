import * as vscode from 'vscode'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { LintOffense } from '@herb-tools/linter'
import type { AnalysisResult, FileStatus } from './types'

const execFileAsync = promisify(execFile)

export class AnalysisService {
  private workerPath: string
  private onVersionUpdate?: (version: string) => void

  constructor(context: vscode.ExtensionContext, onVersionUpdate?: (version: string) => void) {
    this.workerPath = context.asAbsolutePath(path.join('dist', 'parse-worker.js'))
    this.onVersionUpdate = onVersionUpdate
  }

  async analyzeFile(file: string): Promise<AnalysisResult> {
    try {
      const config = vscode.workspace.getConfiguration('languageServerHerb')
      const linterEnabled = config.get('linter.enabled', true)

      const { stdout } = await execFileAsync(process.execPath, [this.workerPath, file, linterEnabled.toString()], { timeout: 1000 })
      const result = JSON.parse(stdout.trim())
      const failed = result.errors > 0 || result.lintErrors > 0

      if (result.version && this.onVersionUpdate) {
        this.onVersionUpdate(result.version)
      }

      return {
        status: failed ? 'failed' : 'ok',
        errors: result.errors as number,
        lintWarnings: result.lintWarnings as number || 0,
        lintErrors: result.lintErrors as number || 0,
        lintOffenses: result.lintOffenses as LintOffense[] || [],
        linterDisabled: result.linterDisabled as boolean || false
      }
    } catch (error: any) {
      if (error.killed) {
        return { status: 'timeout', errors: 0, lintWarnings: 0, lintErrors: 0, lintOffenses: [], linterDisabled: false }
      }

      if (error.stdout) {
        try {
          const result = JSON.parse(error.stdout.trim())
          const failed = result.errors > 0 || result.lintErrors > 0

          if (result.version && this.onVersionUpdate) {
            this.onVersionUpdate(result.version)
          }

          return {
            status: failed ? 'failed' : 'ok',
            errors: result.errors as number,
            lintWarnings: result.lintWarnings as number || 0,
            lintErrors: result.lintErrors as number || 0,
            lintOffenses: result.lintOffenses as LintOffense[] || [],
            linterDisabled: result.linterDisabled as boolean || false
          }
        } catch {
          return { status: 'failed', errors: 1, lintWarnings: 0, lintErrors: 0, lintOffenses: [], linterDisabled: false }
        }
      }

      return { status: 'failed', errors: 1, lintWarnings: 0, lintErrors: 0, lintOffenses: [], linterDisabled: false }
    }
  }

  async analyzeProject(files: FileStatus[], onProgress: (current: number, total: number) => void): Promise<FileStatus[]> {
    const total = files.length
    let done = 0

    const cpus = Math.max(1, require('os').cpus().length)
    const queue = files.map(f => f.uri).slice()
    const workers: Promise<void>[] = Array(cpus)
      .fill(undefined)
      .map(async () => {
        while (queue.length) {
          const uri = queue.shift()!
          const result = await this.analyzeFile(uri.fsPath)
          const index = files.findIndex(file => file.uri.toString() === uri.toString())

          if (index >= 0) {
            files[index] = { uri, ...result }
          }

          await vscode.workspace.openTextDocument(uri)

          done++
          onProgress(done, total)
        }
      })

    await Promise.all(workers)
    return files
  }

  generateSummary(files: FileStatus[]): string {
    const totalParseErrors = files.reduce((sum, file) => sum + file.errors, 0)
    const totalLintErrors = files.reduce((sum, file) => sum + file.lintErrors, 0)
    const totalLintWarnings = files.reduce((sum, file) => sum + file.lintWarnings, 0)
    const totalLintOffenses = files.reduce((sum, file) => sum + file.lintOffenses.length, 0)

    const parseErrorFileCount = files.filter(f => f.errors > 0).length
    const lintOffenseFileCount = files.filter(f => f.lintOffenses.length > 0).length
    const linterDisabled = files.some(f => f.linterDisabled)

    const parts: string[] = []
    if (totalParseErrors > 0) {
      parts.push(`${totalParseErrors} parse error${totalParseErrors === 1 ? '' : 's'} (${parseErrorFileCount} file${parseErrorFileCount === 1 ? '' : 's'})`)
    }
    if (totalLintOffenses > 0) {
      const errorPart = totalLintErrors > 0 ? `${totalLintErrors} error${totalLintErrors === 1 ? '' : 's'}` : ''
      const warningPart = totalLintWarnings > 0 ? `${totalLintWarnings} warning${totalLintWarnings === 1 ? '' : 's'}` : ''
      const lintParts = [errorPart, warningPart].filter(p => p).join(', ')
      parts.push(`${lintParts} (${lintOffenseFileCount} file${lintOffenseFileCount === 1 ? '' : 's'})`)
    }

    let summary = parts.length > 0 ? parts.join(', ') : 'No issues found'
    if (linterDisabled) {
      summary += ' (linting disabled)'
    }

    return summary
  }
}
