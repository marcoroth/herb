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
  private readonly published: Set<string> = new Set()

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
    this.publish(uri, [])
  }

  clearWhere(matches: (uri: string) => boolean) {
    const stale: string[] = []

    for (const uri of this.published) {
      if (matches(uri)) stale.push(uri)
    }

    for (const uri of stale) {
      this.clear(uri)
    }
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

    this.publish(textDocument.uri, allDiagnostics)
  }

  async refreshDocument(document: TextDocument) {
    await this.validate(document)
  }

  async refreshAllDocuments() {
    const documents = this.documentService.getAll()
    await Promise.all(documents.map(document => this.refreshDocument(document)))
  }

  private publish(uri: string, diagnostics: Diagnostic[]) {
    this.connection.sendDiagnostics({ uri, diagnostics })

    if (diagnostics.length > 0) {
      this.published.add(uri)
    } else {
      this.published.delete(uri)
    }
  }
}
