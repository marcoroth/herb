import { parentPort } from "worker_threads"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { rules } from "../rules.js"
import { readFileSync, writeFileSync } from "fs"

import type { Config } from "@herb-tools/config"
import type { ProcessingContext } from "./file-processor.js"

function isRuleAutocorrectable(ruleName: string): boolean {
  const allRules = rules
  const RuleClass = allRules.find((rule: any) => {
    const instance = new rule()
    return instance.name === ruleName
  })

  if (!RuleClass) return false

  return (RuleClass as any).autocorrectable === true
}

interface WorkerMessage {
  filename: string
  filePath: string
  context: ProcessingContext
  formatOption: string
  linterInstance?: any
}

interface WorkerResult {
  filename: string
  fileErrors: number
  fileWarnings: number
  fileInfo: number
  fileHints: number
  fileIgnored: number
  fileWouldBeIgnored: number
  hasOffenses: boolean
  wasFixed: boolean
  fileOffenses: any[]
  fileRuleOffenses: [string, number][]
  fixMessage: string | null
  error?: string
}

async function processFile(message: WorkerMessage): Promise<WorkerResult> {
  try {
    const { filename, filePath, context, formatOption } = message

    await Herb.load()
    const linter = Linter.from(Herb, context?.config as Config)

    let content = readFileSync(filePath, "utf-8")

    const lintResult = linter.lint(content, {
      fileName: filename,
      ignoreDisableComments: context?.ignoreDisableComments
    })

    let fileErrors = 0
    let fileWarnings = 0
    let fileInfo = 0
    let fileHints = 0
    let fileIgnored = lintResult.ignored
    let fileWouldBeIgnored = lintResult.wouldBeIgnored || 0
    let hasOffenses = false
    let wasFixed = false
    const fileOffenses: any[] = []
    const fileRuleOffensesMap = new Map<string, number>()
    let fixMessage: string | null = null

    if (context?.fix && lintResult.offenses.length > 0) {
      const autofixResult = linter.autofix(content, {
        fileName: filename,
        ignoreDisableComments: context?.ignoreDisableComments
      })

      if (autofixResult.fixed.length > 0) {
        writeFileSync(filePath, autofixResult.source, "utf-8")
        wasFixed = true

        if (formatOption !== 'json') {
          fixMessage = `Fixed ${autofixResult.fixed.length} offense(s)`
        }
      }

      content = autofixResult.source

      for (const offense of autofixResult.unfixed) {
        fileOffenses.push({
          filename,
          offense: offense,
          content,
          autocorrectable: isRuleAutocorrectable(offense.rule)
        })

        fileRuleOffensesMap.set(offense.rule, (fileRuleOffensesMap.get(offense.rule) || 0) + 1)
      }

      if (autofixResult.unfixed.length > 0) {
        fileErrors = autofixResult.unfixed.filter(offense => offense.severity === "error").length
        fileWarnings = autofixResult.unfixed.filter(offense => offense.severity === "warning").length
        fileInfo = autofixResult.unfixed.filter(offense => offense.severity === "info").length
        fileHints = autofixResult.unfixed.filter(offense => offense.severity === "hint").length
        hasOffenses = true
      }
    } else if (lintResult.offenses.length === 0) {
      if (formatOption !== 'json') {
        fixMessage = "No issues found"
      }
    } else {
      for (const offense of lintResult.offenses) {
        fileOffenses.push({
          filename,
          offense: offense,
          content,
          autocorrectable: isRuleAutocorrectable(linter, offense.rule)
        })

        fileRuleOffensesMap.set(offense.rule, (fileRuleOffensesMap.get(offense.rule) || 0) + 1)
      }

      fileErrors = lintResult.errors
      fileWarnings = lintResult.warnings
      fileInfo = lintResult.offenses.filter(o => o.severity === "info").length
      fileHints = lintResult.offenses.filter(o => o.severity === "hint").length
      hasOffenses = true
    }

    return {
      filename,
      fileErrors,
      fileWarnings,
      fileInfo,
      fileHints,
      fileIgnored,
      fileWouldBeIgnored,
      hasOffenses,
      wasFixed,
      fileOffenses,
      fileRuleOffenses: Array.from(fileRuleOffensesMap.entries()),
      fixMessage
    }
  } catch (error) {
    return {
      filename: message.filename,
      fileErrors: 0,
      fileWarnings: 0,
      fileInfo: 0,
      fileHints: 0,
      fileIgnored: 0,
      fileWouldBeIgnored: 0,
      hasOffenses: false,
      wasFixed: false,
      fileOffenses: [],
      fileRuleOffenses: [],
      fixMessage: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

if (parentPort) {
  parentPort.on("message", async (message: WorkerMessage) => {
    const result = await processFile(message)
    parentPort!.postMessage(result)
  })
}
