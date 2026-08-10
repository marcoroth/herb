import { TextDocument } from "vscode-languageserver-textdocument"
import { Connection, Diagnostic } from "vscode-languageserver/node"

import { Settings } from "./settings"
import { ParserService } from "./parser_service"
import { DocumentService } from "./document_service"
import { ConfigService } from "./config_service"
import { Workspaces } from "./workspaces"
import { isConfigDocument } from "./utils"

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly parserService: ParserService
  private readonly configService: ConfigService
  private readonly settings: Settings
  private readonly workspaces: Workspaces
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  constructor(
    connection: Connection,
    documentService: DocumentService,
    parserService: ParserService,
    configService: ConfigService,
    settings: Settings,
    workspaces: Workspaces,
  ) {
    this.connection = connection
    this.documentService = documentService
    this.parserService = parserService
    this.configService = configService
    this.settings = settings
    this.workspaces = workspaces
  }

  clear(uri: string) {
    this.connection.sendDiagnostics({ uri, diagnostics: [] })
  }

  async validate(textDocument: TextDocument) {
    if (!this.settings.includes(textDocument.uri)) {
      this.clear(textDocument.uri)

      return
    }

    const workspace = await this.workspaces.ensure(textDocument.uri)
    let allDiagnostics: Diagnostic[] = []

    if (isConfigDocument(textDocument.uri)) {
      allDiagnostics = await (workspace?.configService ?? this.configService).validateDocument(textDocument)
    } else {
      const parseResult = this.parserService.parseDocument(textDocument)
      const lintResult = workspace ? await workspace.linterService.lintDocument(textDocument) : { diagnostics: [] }

      allDiagnostics = [
        ...parseResult.diagnostics,
        ...lintResult.diagnostics,
      ]
    }

    this.diagnostics.set(textDocument, allDiagnostics)
    this.sendDiagnosticsFor(textDocument)
  }

  async refreshDocument(document: TextDocument) {
    await this.validate(document)
  }

  async refreshAllDocuments() {
    const documents = this.documentService.getAll()
    await Promise.all(documents.map(document => this.refreshDocument(document)))
  }

  private sendDiagnosticsFor(textDocument: TextDocument) {
    const diagnostics = this.diagnostics.get(textDocument) || []

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics,
    })

    this.diagnostics.delete(textDocument)
  }
}
