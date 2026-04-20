import { Diagnostic, CodeDescription, Connection } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Linter, rules, ruleDocumentationUrl, type RuleClass } from "@herb-tools/linter"
import { loadCustomRules as loadCustomRulesFromFs } from "@herb-tools/linter/loader"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Settings } from "./settings"
import { Project } from "./project"
import { lintToDignosticSeverity, lintToDignosticTags } from "./utils"
import { lspRangeFromLocation } from "./range_utils"

const OPEN_CONFIG_ACTION = 'Open .herb.yml'

export interface LintServiceResult {
  diagnostics: Diagnostic[]
}

export class LinterService {
  private readonly connection: Connection
  private readonly settings: Settings
  private readonly project: Project
  private readonly source = "Herb Linter "
  private linter?: Linter
  private allRules: RuleClass[] = rules
  private customRulesLoaded = false
  private failedCustomRules: Map<string, string> = new Map()
  private hasShownCustomRuleWarning = false
  private customRulePaths: Map<string, string> = new Map()

  constructor(connection: Connection, settings: Settings, project: Project) {
    this.connection = connection
    this.settings = settings
    this.project = project
  }

  /**
   * Rebuild the linter when config changes
   * This ensures the linter uses the latest rule configuration
   */
  rebuildLinter(): void {
    this.linter = undefined
    this.allRules = rules
    this.customRulesLoaded = false
    this.hasShownCustomRuleWarning = false
    this.failedCustomRules.clear()
    this.customRulePaths.clear()
  }

  /**
   * Load custom rules from the project and merge with built-in rules
   */
  private async loadCustomRules(): Promise<void> {
    if (this.customRulesLoaded) {
      return
    }

    const baseDir = this.project.projectPath

    try {
      const { rules: customRules, ruleInfo, warnings: duplicateWarnings } = await loadCustomRulesFromFs({ baseDir, silent: true })

      if (customRules.length > 0) {
        this.connection.console.log(`[Linter] Loaded ${customRules.length} custom rules: ${ruleInfo.map(r => r.name).join(', ')}`)

        ruleInfo.forEach(({ name, path }) => {
          this.customRulePaths.set(name, path)
        })

        this.allRules = [...rules, ...customRules]

        if (duplicateWarnings.length > 0) {
          duplicateWarnings.forEach(warning => {
            this.connection.console.warn(`[Linter] ${warning}`)
          })
        }
      }

      this.customRulesLoaded = true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.connection.console.error(`[Linter] Failed to load custom rules: ${errorMessage}`)
      this.failedCustomRules.set('custom-rules', errorMessage)
      this.customRulesLoaded = true
    }
  }

  /**
   * Show warning message to user about failed custom rules
   */
  private showCustomRuleWarnings(): void {
    if (this.failedCustomRules.size === 0 || this.hasShownCustomRuleWarning) {
      return
    }

    this.hasShownCustomRuleWarning = true

    const failures = Array.from(this.failedCustomRules.entries())
    const message = failures.length === 1
      ? `Failed to load custom linter rules: ${failures[0][1]}`
      : `Failed to load custom linter rules:\n${failures.map(([_, error], i) => `${i + 1}. ${error}`).join('\n')}`

    if (this.settings.hasShowDocumentCapability) {
      this.connection.window.showWarningMessage(message, { title: OPEN_CONFIG_ACTION }).then(action => {
        if (action?.title === OPEN_CONFIG_ACTION) {
          const configPath = `${this.project.projectPath}/.herb.yml`
          this.connection.window.showDocument({ uri: `file://${configPath}`, takeFocus: true })
        }
      })
    } else {
      this.connection.window.showWarningMessage(message)
    }
  }

  private shouldLintFile(uri: string): boolean {
    const filePath = uri.replace(/^file:\/\//, '')

    if (filePath.endsWith('.herb.yml')) return false

    const config = this.settings.projectConfig
    if (!config) return true

    const hasConfigFile = Config.exists(config.projectPath)
    if (!hasConfigFile) return true

    const relativePath = filePath.replace(this.project.projectPath + '/', '')

    return config.isLinterEnabledForPath(relativePath)
  }

  async lintDocument(textDocument: TextDocument): Promise<LintServiceResult> {
    if (!this.shouldLintFile(textDocument.uri)) {
      return { diagnostics: [] }
    }

    const settings = await this.settings.getDocumentSettings(textDocument.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    if (!linterEnabled) {
      return { diagnostics: [] }
    }

    const projectConfig = this.settings.projectConfig

    if (!this.linter) {
      await this.loadCustomRules()

      this.showCustomRuleWarnings()

      const linterConfig = projectConfig?.config?.linter || { enabled: true, rules: {} }

      const config = Config.fromObject({
        linter: {
          ...linterConfig,
          rules: {
            ...linterConfig.rules,
            'parser-no-errors': { enabled: false }
          }
        }
      }, {
        projectPath: projectConfig?.projectPath || process.cwd(),
        configVersion: projectConfig?.configVersion
      })

      const { enabled: filteredRules } = Linter.filterRulesByConfig(this.allRules, config.linter?.rules, config.configVersion)

      this.linter = new Linter(Herb, filteredRules, config, this.allRules)
      this.linter.mode = "editor"
    }

    const content = textDocument.getText()
    const lintResult = this.linter.lint(content, { fileName: textDocument.uri })

    const diagnostics: Diagnostic[] = lintResult.offenses.map(offense => {
      const range = lspRangeFromLocation(offense.location)

      const customRulePath = this.customRulePaths.get(offense.rule)
      const codeDescription: CodeDescription = {
        href: customRulePath
          ? `file://${customRulePath}`
          : ruleDocumentationUrl(offense.rule)
      }

      const diagnostic: Diagnostic = {
        source: this.source,
        severity: lintToDignosticSeverity(offense.severity),
        range,
        message: offense.message,
        code: offense.rule,
        data: { rule: offense.rule },
        codeDescription
      }

      const tags = lintToDignosticTags(offense.tags)

      if (tags.length > 0) {
        diagnostic.tags = tags
      }

      return diagnostic
    })

    return { diagnostics }
  }
}
