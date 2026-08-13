import { TextDocument } from "vscode-languageserver-textdocument"
import { Diagnostic, DiagnosticRelatedInformation, CodeDescription, Connection, Position, Range } from "vscode-languageserver/node"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "@herb-tools/linter"
import { Config } from "@herb-tools/config"

import { Project } from "./project"
import { UserSettings } from "./user_settings"
import { Capabilities } from "./capabilities"

import { join } from "node:path"
import { rules, ruleDocumentationUrl } from "@herb-tools/linter"
import { loadCustomRules as loadCustomRulesFromFs } from "@herb-tools/linter/loader"
import { isConfigDocument, lintToDiagnosticSeverity, lintToDiagnosticTags } from "./utils"
import { lspRangeFromLocation } from "@herb-tools/language-service"

import type { RuleClass } from "@herb-tools/linter"
import type { AncestorChain } from "@herb-tools/analysis"
import type { ProjectIndex } from "@herb-tools/analysis/node"

const FRAME_VERBS: Record<string, string> = {
  render: "rendered from",
  layout: "rendered into",
  declaration: "declared at",
}

export interface LintServiceResult {
  diagnostics: Diagnostic[]
  warnings: LinterWarning[]
}

/**
 * Something the user should be told about their linter setup. The service
 * reports these rather than talking to the client itself, so that what it does
 * is decided by whoever owns the connection.
 */
export interface LinterWarning {
  message: string
  configPath: string
}

export class LinterService {
  private readonly connection: Connection
  private readonly userSettings: UserSettings
  private readonly capabilities: Capabilities
  private readonly project: Project
  private readonly index: ProjectIndex
  private readonly source = "Herb Linter "
  private config?: Config
  private linter?: Linter
  private allRules: RuleClass[] = rules
  private customRulesLoaded = false
  private failedCustomRules: Map<string, string> = new Map()
  private hasShownCustomRuleWarning = false
  private customRulePaths: Map<string, string> = new Map()

  constructor(connection: Connection, userSettings: UserSettings, capabilities: Capabilities, project: Project, index: ProjectIndex) {
    this.connection = connection
    this.userSettings = userSettings
    this.capabilities = capabilities
    this.project = project
    this.index = index
  }

  setConfig(config: Config): void {
    this.config = config
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

    const baseDir = this.project.root

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
   * Reports each custom-rule failure once, so a broken config does not nag on
   * every keystroke.
   */
  private takeCustomRuleWarnings(): LinterWarning[] {
    if (this.failedCustomRules.size === 0 || this.hasShownCustomRuleWarning) {
      return []
    }

    this.hasShownCustomRuleWarning = true

    const failures = Array.from(this.failedCustomRules.entries())
    const message = failures.length === 1
      ? `Failed to load custom linter rules: ${failures[0][1]}`
      : `Failed to load custom linter rules:\n${failures.map(([_, error], i) => `${i + 1}. ${error}`).join('\n')}`

    return [{ message, configPath: `${this.project.root}/.herb.yml` }]
  }

  private shouldLintFile(uri: string): boolean {
    const filePath = uri.replace(/^file:\/\//, '')

    if (isConfigDocument(filePath)) return false

    const config = this.config
    if (!config) return true

    const hasConfigFile = Config.exists(config.projectPath)
    if (!hasConfigFile) return true

    const relativePath = filePath.replace(this.project.root + '/', '')

    return config.isLinterEnabledForPath(relativePath)
  }

  private messageFor(offense: { message: string, renderedFrom?: AncestorChain }): string {
    if (this.capabilities.hasDiagnosticRelatedInformation) return offense.message

    const frames = (offense.renderedFrom?.frames ?? []).filter(frame => frame.location !== null)

    if (frames.length === 0) return offense.message

    const caller = frames[frames.length - 1]

    const verb = FRAME_VERBS[caller.via] ?? FRAME_VERBS.render

    return `${offense.message} ${verb.charAt(0).toUpperCase()}${verb.slice(1)} \`${caller.file}:${caller.location!.line}:${caller.location!.column}\`.`
  }

  private callChainFor(offense: { renderedFrom?: AncestorChain }): DiagnosticRelatedInformation[] {
    const frames = offense.renderedFrom?.frames ?? []
    const information: DiagnosticRelatedInformation[] = []

    for (const frame of [...frames].reverse()) {
      if (!frame.location) continue

      const position = Position.create(Math.max(frame.location.line - 1, 0), frame.location.column)
      const nesting = frame.ancestors.length > 0 ? ` inside ${frame.ancestors.map(tag => `<${tag}>`).join(" › ")}` : ""

      information.push({
        location: {
          uri: `file://${join(this.project.root, frame.file)}`,
          range: Range.create(position, position)
        },
        message: `${FRAME_VERBS[frame.via] ?? FRAME_VERBS.render} here${nesting}`
      })
    }

    return information
  }

  async lintDocument(textDocument: TextDocument): Promise<LintServiceResult> {
    if (!this.shouldLintFile(textDocument.uri)) {
      return { diagnostics: [], warnings: [] }
    }

    const settings = await this.project.settingsFor(textDocument.uri)
    const linterEnabled = settings?.linter?.enabled ?? true

    if (!linterEnabled) {
      return { diagnostics: [], warnings: [] }
    }

    const projectConfig = this.config
    const warnings: LinterWarning[] = []

    if (!this.linter) {
      await this.loadCustomRules()

      warnings.push(...this.takeCustomRuleWarnings())

      const linterConfig = projectConfig?.config?.linter || { enabled: true, rules: {} }

      const config = Config.fromObject({
        framework: projectConfig?.config?.framework,
        template_engine: projectConfig?.config?.template_engine,
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

    const lintResult = this.linter.lint(content, {
      fileName: this.index.relativePathFor(textDocument.uri) ?? textDocument.uri,
      partials: this.index.partials,
      partialCallers: this.index?.callers,
    })

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
        severity: lintToDiagnosticSeverity(offense.severity),
        range,
        message: this.messageFor(offense),
        code: offense.rule,
        data: { rule: offense.rule },
        codeDescription
      }

      const tags = lintToDiagnosticTags(offense.tags)

      if (tags.length > 0) {
        diagnostic.tags = tags
      }

      if (this.capabilities.hasDiagnosticRelatedInformation) {
        const relatedInformation = this.callChainFor(offense)

        if (relatedInformation.length > 0) {
          diagnostic.relatedInformation = relatedInformation
        }
      }

      return diagnostic
    })

    return { diagnostics, warnings }
  }
}
