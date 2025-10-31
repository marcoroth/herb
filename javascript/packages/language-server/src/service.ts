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
import { CodeActionService } from "./code_action_service"
import { version } from "../package.json"

export class Service {
  connection: Connection
  settings: Settings
  diagnostics: Diagnostics
  documentService: DocumentService
  parserService: ParserService
  linterService: LinterService
  project: Project
  config?: Config
  formatting: FormattingService
  configService: ConfigService
  codeActionService: CodeActionService

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.project = new Project(connection, this.settings.projectPath.replace("file://", ""))
    this.parserService = new ParserService()
    this.linterService = new LinterService(this.settings)
    this.formatting = new FormattingService(this.connection, this.documentService.documents, this.project, this.settings)
    this.configService = new ConfigService(this.project.projectPath)
    this.diagnostics = new Diagnostics(this.connection, this.documentService, this.parserService, this.linterService, this.configService)
    this.codeActionService = new CodeActionService(this.project, this.config)

    if (params.initializationOptions) {
      this.settings.globalSettings = params.initializationOptions as PersonalHerbSettings
    }
  }

  async init() {
    await this.project.initialize()
    await this.formatting.initialize()

    try {
      this.config = await Config.loadForEditor(this.project.projectPath, version)
      this.codeActionService.setConfig(this.config)

      if (this.config.version && this.config.version !== version) {
        this.connection.console.warn(
          `Config file version (${this.config.version}) does not match current version (${version}). ` +
          `Consider updating your .herb.yml file.`
        )
      }
    } catch (error) {
      this.connection.console.warn(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}. Using defaults.`
      )
      this.config = Config.fromObject({}, { projectPath: this.project.projectPath, version })
      this.codeActionService.setConfig(this.config)
    }

    await this.settings.initializeProjectConfig(this.config)

    this.documentService.onDidClose((change) => {
      this.settings.documentSettings.delete(change.document.uri)
    })

    this.documentService.onDidChangeContent(async (change) => {
      await this.diagnostics.refreshDocument(change.document)
    })
  }

  async refresh() {
    await this.project.refresh()
    await this.diagnostics.refreshAllDocuments()
  }

  async refreshConfig() {
    try {
      this.config = await Config.loadForEditor(this.project.projectPath, version)

      this.codeActionService.setConfig(this.config)

      if (this.config.version && this.config.version !== version) {
        this.connection.console.warn(
          `Config file version (${this.config.version}) does not match current version (${version}). ` +
          `Consider updating your .herb.yml file.`
        )
      }
    } catch (error) {
      this.connection.console.warn(
        `Failed to load config: ${error instanceof Error ? error.message : String(error)}. Using defaults.`
      )

      if (!this.config) {
        this.config = Config.fromObject({}, { projectPath: this.project.projectPath, version })
        this.codeActionService.setConfig(this.config)
      }
    }

    await this.settings.refreshProjectConfig(this.config)
    await this.formatting.refreshConfig()

    this.linterService.rebuildLinter()
  }
}
