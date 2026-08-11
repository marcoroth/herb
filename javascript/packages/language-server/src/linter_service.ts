import { Diagnostic, DiagnosticRelatedInformation, CodeDescription, Connection, Position, Range } from "vscode-languageserver/node"
import { join } from "node:path"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Linter, rules, ruleDocumentationUrl, type RuleClass } from "@herb-tools/linter"
import { loadCustomRules as loadCustomRulesFromFs } from "@herb-tools/linter/loader"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Settings } from "./settings"
import { Project } from "./project"

import type { AncestorChain } from "@herb-tools/core"

const FRAME_VERBS: Record<string, string> = {
  render: "rendered from",
  layout: "rendered into",
  declaration: "declared at",
}
import { PartialIndexService } from "./partial_index_service"
import { PartialCallerIndexService } from "./partial_caller_index_service"
import { isConfigDocument, lintToDiagnosticSeverity, lintToDiagnosticTags } from "./utils"
import { lspRangeFromLocation } from "./range_utils"

const OPEN_CONFIG_ACTION = 'Open .herb.yml'

export interface LintServiceResult {
  diagnostics: Diagnostic[]
}

export class LinterService {
  private readonly connection: Connection
  private readonly settings: Settings
  private readonly project: Project
  private readonly partialIndexService: PartialIndexService
  private readonly partialCallerIndexService?: PartialCallerIndexService
  private readonly source = "Herb Linter "
  private config?: Config
  private linter?: Linter
  private allRules: RuleClass[] = rules
  private customRulesLoaded = false
  private failedCustomRules: Map<string, string> = new Map()
  private hasShownCustomRuleWarning = false
  private customRulePaths: Map<string, string> = new Map()

  constructor(connection: Connection, settings: Settings, project: Project, partialIndexService: PartialIndexService, partialCallerIndexService?: PartialCallerIndexService) {
    this.connection = connection
    this.settings = settings
    this.project = project
    this.partialIndexService = partialIndexService
    this.partialCallerIndexService = partialCallerIndexService
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

    if (isConfigDocument(filePath)) return false

    const config = this.config
    if (!config) return true

    const hasConfigFile = Config.exists(config.projectPath)
    if (!hasConfigFile) return true

    const relativePath = filePath.replace(this.project.projectPath + '/', '')

    return config.isLinterEnabledForPath(relativePath)
  }

  private messageFor(offense: { message: string, renderedFrom?: AncestorChain }): string {
    if (this.settings.hasDiagnosticRelatedInformationCapability) return offense.message

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
          uri: `file://${join(this.project.projectPath, frame.file)}`,
          range: Range.create(position, position)
        },
        message: `${FRAME_VERBS[frame.via] ?? FRAME_VERBS.render} here${nesting}`
      })
    }

    return information
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

    const projectConfig = this.config

    if (!this.linter) {
      await this.loadCustomRules()

      this.showCustomRuleWarnings()

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
      fileName: this.partialIndexService.relativePathFor(textDocument.uri) ?? textDocument.uri,
      partials: this.partialIndexService.index,
      partialCallers: this.partialCallerIndexService?.index,
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

      if (this.settings.hasDiagnosticRelatedInformationCapability) {
        const relatedInformation = this.callChainFor(offense)

        if (relatedInformation.length > 0) {
          diagnostic.relatedInformation = relatedInformation
        }
      }

      return diagnostic
    })

    return { diagnostics }
  }
}
