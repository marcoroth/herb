import { Connection, InitializeParams } from "vscode-languageserver/node"

import { Settings, HerbSettings } from "./settings"
import { DocumentService } from "./document_service"
import { Diagnostics } from "./diagnostics"
import { ParserService } from "./parser_service"
import { LinterService } from "./linter_service"
import { Config } from "./config"
import { Project } from "./project"
import { FormattingService } from "./formatting_service"
import { AutofixService } from "./autofix_service"
import { CodeActionService } from "./code_action_service"

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
  autofix: AutofixService
  codeAction: CodeActionService

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.project = new Project(connection, this.settings.projectPath.replace("file://", ""))
    this.parserService = new ParserService()
    this.linterService = new LinterService(this.settings)
    this.formatting = new FormattingService(this.connection, this.documentService.documents, this.project, this.settings)
    this.autofix = new AutofixService(this.connection, this.settings)
    this.codeAction = new CodeActionService(this.settings)
    this.diagnostics = new Diagnostics(this.connection, this.documentService, this.parserService, this.linterService)

    if (params.initializationOptions) {
      this.settings.globalSettings = params.initializationOptions as HerbSettings
    }
  }

  async init() {
    await this.project.initialize()
    await this.formatting.initialize()

    this.config = await Config.fromPathOrNew(this.project.projectPath)

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
    this.config = await Config.fromPathOrNew(this.project.projectPath)
    await this.formatting.refreshConfig()
  }
}
