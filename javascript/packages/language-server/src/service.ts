import { Connection, InitializeParams } from "vscode-languageserver/node"

import { Settings, PersonalHerbSettings } from "./settings"
import { DocumentService } from "./document_service"
import { Diagnostics } from "./diagnostics"
import { ParserService } from "./parser_service"
import { LinterService } from "./linter_service"
import { Config } from "@herb-tools/config"
import { Project } from "./project"
import { FormattingService } from "./formatting_service"
import { ConfigService } from "./config_service"
import { AutofixService } from "./autofix_service"
import { CodeActionService } from "./code_action_service"
import { DocumentSaveService } from "./document_save_service"

import { version } from "../package.json"

export class Service {
  connection: Connection
  settings: Settings
  project: Project
  config?: Config

  diagnostics: Diagnostics
  documentService: DocumentService
  parserService: ParserService
  linterService: LinterService
  formattingService: FormattingService
  autofixService: AutofixService
  configService: ConfigService
  codeActionService: CodeActionService
  documentSaveService: DocumentSaveService

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.project = new Project(connection, this.settings.projectPath.replace("file://", ""))
    this.parserService = new ParserService()
    this.linterService = new LinterService(this.settings)
    this.formattingService = new FormattingService(this.connection, this.documentService.documents, this.project, this.settings)
    this.autofixService = new AutofixService(this.connection, this.config)
    this.configService = new ConfigService(this.project.projectPath)
    this.codeActionService = new CodeActionService(this.project, this.config)
    this.diagnostics = new Diagnostics(this.connection, this.documentService, this.parserService, this.linterService, this.configService)
    this.documentSaveService = new DocumentSaveService(this.connection, this.settings, this.autofixService, this.formattingService)

    if (params.initializationOptions) {
      this.settings.globalSettings = params.initializationOptions as PersonalHerbSettings
    }
  }

  async init() {
    await this.project.initialize()
    await this.formattingService.initialize()

    try {
      this.config = await Config.loadForEditor(this.project.projectPath, version)
      this.codeActionService.setConfig(this.config)
      this.autofixService.setConfig(this.config)

      if (this.config.version && this.config.version !== version) {
        this.connection.console.warn(
          `Config file version (${this.config.version}) does not match current version (${version}). ` +
          `Consider updating your .herb.yml file.`
        )
      }
    } catch (error) {
      this.connection.console.warn(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}. Using personal settings with defaults.`
      )
      this.config = Config.fromObject({
        linter: this.settings.globalSettings.linter,
        formatter: this.settings.globalSettings.formatter
      }, { projectPath: this.project.projectPath, version })

      this.codeActionService.setConfig(this.config)
      this.autofixService.setConfig(this.config)
    }

    await this.settings.initializeProjectConfig(this.config)
    await this.formattingService.refreshConfig(this.config)
    this.linterService.rebuildLinter()

    this.documentService.onDidClose((change) => {
      this.settings.documentSettings.delete(change.document.uri)
    })

    this.documentService.onDidChangeContent(async (change) => {
      await this.diagnostics.refreshDocument(change.document)
    })
  }

  async refresh() {
    await this.project.refresh()
    await this.formattingService.refreshConfig(this.config)
    await this.diagnostics.refreshAllDocuments()
  }

  async refreshConfig() {
    try {
      this.config = await Config.loadForEditor(this.project.projectPath, version)

      this.codeActionService.setConfig(this.config)
      this.autofixService.setConfig(this.config)

      if (this.config.version && this.config.version !== version) {
        this.connection.console.warn(
          `Config file version (${this.config.version}) does not match current version (${version}). ` +
          `Consider updating your .herb.yml file.`
        )
      }
    } catch (error) {
      this.connection.console.warn(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}. Using personal settings with defaults.`
      )

      this.config = Config.fromObject({
        linter: this.settings.globalSettings.linter,
        formatter: this.settings.globalSettings.formatter
      }, { projectPath: this.project.projectPath, version })

      this.codeActionService.setConfig(this.config)
      this.autofixService.setConfig(this.config)
    }

    await this.settings.refreshProjectConfig(this.config)
    await this.formattingService.refreshConfig(this.config)

    this.linterService.rebuildLinter()
  }
}
