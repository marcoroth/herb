import { Diagnostic, DiagnosticSeverity, Range, Position, CodeDescription, Connection } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Linter } from "@herb-tools/linter"
import { Herb } from "@herb-tools/node-wasm"

import { Settings } from "./settings"

import type { LintSeverity } from "@herb-tools/linter"
import { Project } from "./project"
import { Config } from "./config"

export interface LintServiceResult {
  diagnostics: Diagnostic[]
}

export class LinterService {
  private readonly settings: Settings
  private readonly source = "Herb Linter "
  private connection: Connection
  private project: Project
  private linter: Linter
  private config?: Config

  constructor(connection: Connection, project: Project, settings: Settings) {
    this.connection = connection
    this.project = project
    this.settings = settings
    this.linter = new Linter(Herb)
  }

  async initialize() {
    try {
      this.config = await Config.fromPathOrNew(this.project.projectPath)

      this.connection.console.log("Herb linter initialized successfully")
    } catch (error) {
      this.connection.console.error(`Failed to initialize Herb linter: ${error}`)
    }
  }

  async refreshConfig() {
    this.config = await Config.fromPathOrNew(this.project.projectPath)
  }

  private async getLinterOptions(uri: string) {
    const settings = await this.settings.getDocumentSettings(uri)
    const projectLinter = this.config?.options.linter || {}

    const enabled = projectLinter.enabled ?? settings?.linter?.enabled ?? true
    const excludedRules = projectLinter.excludedRules ?? settings?.linter?.excludedRules ?? ["parser-no-errors"]

    return {
      enabled,
      excludedRules,
    }
  }

  async lintDocument(textDocument: TextDocument): Promise<LintServiceResult> {
    const { enabled, excludedRules } = await this.getLinterOptions(textDocument.uri);

    if (!enabled) {
      return { diagnostics: [] }
    }

    const lintResult = this.linter.lint(textDocument.getText(), { fileName: textDocument.uri })
    const offenses = lintResult.offenses.filter(offense => !excludedRules.includes(offense.rule))

    const diagnostics: Diagnostic[] = offenses.map(offense => {
      const range = Range.create(
        Position.create(offense.location.start.line - 1, offense.location.start.column),
        Position.create(offense.location.end.line - 1, offense.location.end.column),
      )

      const codeDescription: CodeDescription = {
        href: `https://herb-tools.dev/linter/rules/${offense.rule}`
      }

      return {
        source: this.source,
        severity: this.lintToDignosticSeverity(offense.severity),
        range,
        message: offense.message,
        code: offense.rule,
        data: { rule: offense.rule },
        codeDescription
      }
    })

    return { diagnostics }
  }

  private lintToDignosticSeverity(severity: LintSeverity): DiagnosticSeverity {
    switch (severity) {
      case "error": return DiagnosticSeverity.Error
      case "warning": return DiagnosticSeverity.Warning
      case "info": return DiagnosticSeverity.Information
      case "hint": return DiagnosticSeverity.Hint
    }
  }
}
