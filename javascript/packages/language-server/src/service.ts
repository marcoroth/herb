import { Connection, InitializeParams } from "vscode-languageserver/node"

import { Settings, HerbSettings } from "./settings"
import { DocumentService } from "./document_service"
import { Diagnostics } from "./diagnostics"
import { ParserService } from "./parser_service"
import { LinterService } from "./linter_service"
import { Config } from "./config"
import { Project } from "./project"
import { FormattingService } from "./formatting_service"

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

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.project = new Project(connection, this.settings.projectPath.replace("file://", ""))
    this.parserService = new ParserService()
    this.linterService = new LinterService(this.settings)
    this.formatting = new FormattingService(this.connection, this.documentService.documents, this.project, this.settings)
    this.diagnostics = new Diagnostics(this.connection, this.documentService, this.parserService, this.linterService)

    // Initialize global settings from initialization options
    if (params.initializationOptions) {
      this.settings.globalSettings = params.initializationOptions as HerbSettings
    }
  }

  async init() {
    await this.project.initialize()
    await this.formatting.initialize()

    this.config = await Config.fromPathOrNew(this.project.projectPath)

    // Only keep settings for open documents
    this.documentService.onDidClose((change) => {
      this.settings.documentSettings.delete(change.document.uri)
    })

    // The content of a text document has changed. This event is emitted
    // when the text document first opened or when its content has changed.
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
