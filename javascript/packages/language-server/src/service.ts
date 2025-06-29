import { Connection, InitializeParams } from "vscode-languageserver/node"

import { Settings } from "./settings"
import { DocumentService } from "./document_service"
import { Diagnostics } from "./diagnostics"
import { Config } from "./config"
import { Project } from "./project"

export class Service {
  connection: Connection
  settings: Settings
  diagnostics: Diagnostics
  documentService: DocumentService
  project: Project
  config?: Config

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.project = new Project(connection, this.settings.projectPath.replace("file://", ""))
    this.diagnostics = new Diagnostics(this.connection, this.documentService)
  }

  async init() {
    await this.project.initialize()

    this.config = await Config.fromPathOrNew(this.project.projectPath)

    // Only keep settings for open documents
    this.documentService.onDidClose((change) => {
      this.settings.documentSettings.delete(change.document.uri)
    })

    // The content of a text document has changed. This event is emitted
    // when the text document first opened or when its content has changed.
    this.documentService.onDidChangeContent((change) => {
      this.diagnostics.refreshDocument(change.document)
    })
  }

  async refresh() {
    await this.project.refresh()

    this.diagnostics.refreshAllDocuments()
  }

  async refreshConfig() {
    this.config = await Config.fromPathOrNew(this.project.projectPath)
  }
}
