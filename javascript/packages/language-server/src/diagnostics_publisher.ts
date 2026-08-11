import { TextDocument } from "vscode-languageserver-textdocument"
import { Connection, Diagnostic } from "vscode-languageserver/node"

import { WorkspaceFolders } from "./workspace_folders"
import { ParserService } from "./parser_service"
import { Documents } from "./documents"
import { ConfigService } from "./config_service"
import { Projects } from "./projects"
import { isConfigDocument } from "./utils"

export class DiagnosticsPublisher {
  private readonly connection: Connection
  private readonly documents: Documents
  private readonly parserService: ParserService
  private readonly configService: ConfigService
  private readonly workspaceFolders: WorkspaceFolders
  private readonly projects: Projects
  private readonly published: Set<string> = new Set()

  constructor(
    connection: Connection,
    documents: Documents,
    parserService: ParserService,
    configService: ConfigService,
    workspaceFolders: WorkspaceFolders,
    projects: Projects,
  ) {
    this.connection = connection
    this.documents = documents
    this.parserService = parserService
    this.configService = configService
    this.workspaceFolders = workspaceFolders
    this.projects = projects
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
    if (!this.workspaceFolders.includes(textDocument.uri)) {
      this.clear(textDocument.uri)

      return
    }

    const project = await this.projects.ensure(textDocument.uri)
    let allDiagnostics: Diagnostic[] = []

    if (isConfigDocument(textDocument.uri)) {
      allDiagnostics = await (project?.configService ?? this.configService).validateDocument(textDocument)
    } else {
      const parseResult = this.parserService.parseDocument(textDocument)
      const lintResult = project ? await project.linterService.lintDocument(textDocument) : { diagnostics: [] }

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
    const documents = this.documents.getAll()
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
