import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../linter.js"
import { loadCustomRules } from "../loader.js"
import { Config } from "@herb-tools/config"

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { colorize } from "@herb-tools/highlighter"

import type { Diagnostic } from "@herb-tools/core"
import type { FormatOption } from "./argument-parser.js"
import type { HerbConfigOptions } from "@herb-tools/config"

export interface ProcessedFile {
  filename: string
  offense: Diagnostic
  content: string
  autocorrectable?: boolean
}

export interface ProcessingContext {
  projectPath?: string
  pattern?: string
  fix?: boolean
  ignoreDisableComments?: boolean
  linterConfig?: HerbConfigOptions['linter']
  config?: Config
  loadCustomRules?: boolean
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
  context?: ProcessingContext
}

export class FileProcessor {
  private linter: Linter | null = null
  private customRulesLoaded: boolean = false

  private isRuleAutocorrectable(ruleName: string): boolean {
    if (!this.linter) return false

    const RuleClass = (this.linter as any).rules.find((rule: any) => {
      const instance = new rule()

      return instance.name === ruleName
    })

    if (!RuleClass) return false

    return RuleClass.autocorrectable === true
  }

  async processFiles(files: string[], formatOption: FormatOption = 'detailed', context?: ProcessingContext): Promise<ProcessingResult> {
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

    if (!this.linter) {
      let customRules = undefined
      let customRuleInfo: Array<{ name: string, path: string }> = []
      let customRuleWarnings: string[] = []

      if (context?.loadCustomRules && !this.customRulesLoaded) {
        try {
          const result = await loadCustomRules({
            baseDir: context.projectPath,
            silent: formatOption === 'json'
          })

          customRules = result.rules
          customRuleInfo = result.ruleInfo
          customRuleWarnings = result.warnings

          this.customRulesLoaded = true

          if (customRules.length > 0 && formatOption !== 'json') {
            const ruleText = customRules.length === 1 ? 'rule' : 'rules'
            console.log(colorize(`\nLoaded ${customRules.length} custom ${ruleText}:`, "green"))

            for (const { name, path } of customRuleInfo) {
              const relativePath = context.projectPath ? path.replace(context.projectPath + '/', '') : path
              console.log(colorize(`  • ${name}`, "cyan") + colorize(` (${relativePath})`, "dim"))
            }

            if (customRuleWarnings.length > 0) {
              console.log()
              for (const warning of customRuleWarnings) {
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
      }

      this.linter = Linter.from(Herb, context?.config, customRules)
    }

    for (const filename of files) {
      const filePath = context?.projectPath ? resolve(context.projectPath, filename) : resolve(filename)
      let content = readFileSync(filePath, "utf-8")

      const lintResult = this.linter.lint(content, {
        fileName: filename,
        ignoreDisableComments: context?.ignoreDisableComments
      })

      if (ruleCount === 0) {
        ruleCount = this.linter.getRuleCount()
      }

      if (context?.fix && lintResult.offenses.length > 0) {
        const autofixResult = this.linter.autofix(content, {
          fileName: filename,
          ignoreDisableComments: context?.ignoreDisableComments
        })

        if (autofixResult.fixed.length > 0) {
          writeFileSync(filePath, autofixResult.source, "utf-8")

          filesFixed++

          if (formatOption !== 'json') {
            console.log(`${colorize("✓", "brightGreen")} ${colorize(filename, "cyan")} - ${colorize(`Fixed ${autofixResult.fixed.length} offense(s)`, "green")}`)
          }
        }

        content = autofixResult.source

        for (const offense of autofixResult.unfixed) {
          allOffenses.push({
            filename,
            offense: offense,
            content,
            autocorrectable: this.isRuleAutocorrectable(offense.rule)
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
            content,
            autocorrectable: this.isRuleAutocorrectable(offense.rule)
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
      context
    }

    if (totalWouldBeIgnored > 0) {
      result.totalWouldBeIgnored = totalWouldBeIgnored
    }

    return result
  }
}
