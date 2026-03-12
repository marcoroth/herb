import { workerData, parentPort } from "node:worker_threads"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Diagnostic } from "@herb-tools/core"
import { Linter } from "../linter.js"
import { loadCustomRules } from "../loader.js"

export interface WorkerInput {
  files: string[]
  projectPath: string
  configPath?: string
  fix: boolean
  fixUnsafe: boolean
  ignoreDisableComments: boolean
  loadCustomRules: boolean
}

export interface WorkerOffense {
  filename: string
  offense: Diagnostic
  content: string
  autocorrectable: boolean
}

export interface WorkerResult {
  totalErrors: number
  totalWarnings: number
  totalInfo: number
  totalHints: number
  totalIgnored: number
  totalWouldBeIgnored: number
  filesWithOffenses: number
  filesFixed: number
  ruleCount: number
  offenses: WorkerOffense[]
  ruleOffenses: [string, { count: number, files: string[] }][]
  fixMessages: string[]
  error?: string
}

async function run() {
  const data = workerData as WorkerInput

  await Herb.load()

  const config = await Config.load(data.configPath || data.projectPath, {
    exitOnError: false,
    createIfMissing: false,
    silent: true
  })

  let customRules = undefined

  if (data.loadCustomRules) {
    try {
      const result = await loadCustomRules({ baseDir: data.projectPath, silent: true })
      customRules = result.rules
    } catch {
      // Silently ignore custom rule loading failures in workers
    }
  }

  const linter = Linter.from(Herb, config, customRules)

  let totalErrors = 0
  let totalWarnings = 0
  let totalInfo = 0
  let totalHints = 0
  let totalIgnored = 0
  let totalWouldBeIgnored = 0
  let filesWithOffenses = 0
  let filesFixed = 0

  const ruleCount = linter.getRuleCount()
  const allOffenses: WorkerOffense[] = []
  const ruleOffenses = new Map<string, { count: number, files: Set<string> }>()
  const fixMessages: string[] = []

  const isRuleAutocorrectable = (ruleName: string): boolean => {
    const ruleClass = linter.rules.find(
      (rule) => rule.ruleName === ruleName
    )

    if (!ruleClass) return false

    // TODO: fix types
    return (ruleClass as any).autocorrectable === true
  }

  for (const filename of data.files) {
    const filePath = data.projectPath ? resolve(data.projectPath, filename) : resolve(filename)
    let content = readFileSync(filePath, "utf-8")

    const lintResult = linter.lint(content, {
      fileName: filename,
      ignoreDisableComments: data.ignoreDisableComments
    })

    if (data.fix && lintResult.offenses.length > 0) {
      const autofixResult = linter.autofix(content, {
        fileName: filename,
        ignoreDisableComments: data.ignoreDisableComments
      }, undefined, { includeUnsafe: data.fixUnsafe })

      if (autofixResult.fixed.length > 0) {
        writeFileSync(filePath, autofixResult.source, "utf-8")
        filesFixed++
        fixMessages.push(`${filename}\t${autofixResult.fixed.length}`)
      }

      content = autofixResult.source

      for (const offense of autofixResult.unfixed) {
        allOffenses.push({
          filename,
          offense,
          content,
          autocorrectable: isRuleAutocorrectable(offense.rule)
        })

        const ruleData = ruleOffenses.get(offense.rule) || { count: 0, files: new Set() }
        ruleData.count++
        ruleData.files.add(filename)
        ruleOffenses.set(offense.rule, ruleData)
      }

      if (autofixResult.unfixed.length > 0) {
        totalErrors += autofixResult.unfixed.filter(o => o.severity === "error").length
        totalWarnings += autofixResult.unfixed.filter(o => o.severity === "warning").length
        totalInfo += autofixResult.unfixed.filter(o => o.severity === "info").length
        totalHints += autofixResult.unfixed.filter(o => o.severity === "hint").length
        filesWithOffenses++
      }
    } else if (lintResult.offenses.length > 0) {
      for (const offense of lintResult.offenses) {
        allOffenses.push({
          filename,
          offense,
          content,
          autocorrectable: isRuleAutocorrectable(offense.rule)
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

  const serializedRuleOffenses: [string, { count: number, files: string[] }][] =
    Array.from(ruleOffenses.entries()).map(
      ([rule, data]) => [rule, { count: data.count, files: Array.from(data.files) }]
    )

  const result: WorkerResult = {
    totalErrors,
    totalWarnings,
    totalInfo,
    totalHints,
    totalIgnored,
    totalWouldBeIgnored,
    filesWithOffenses,
    filesFixed,
    ruleCount,
    offenses: allOffenses,
    ruleOffenses: serializedRuleOffenses,
    fixMessages
  }

  parentPort!.postMessage(result)
}

run().catch(error => {
  const errorResult: WorkerResult = {
    totalErrors: 0,
    totalWarnings: 0,
    totalInfo: 0,
    totalHints: 0,
    totalIgnored: 0,
    totalWouldBeIgnored: 0,
    filesWithOffenses: 0,
    filesFixed: 0,
    ruleCount: 0,
    offenses: [],
    ruleOffenses: [],
    fixMessages: [],
    error: error instanceof Error ? error.message : String(error)
  }

  parentPort!.postMessage(errorResult)
})
