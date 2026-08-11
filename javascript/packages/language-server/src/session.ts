import { join } from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { Connection, InitializeParams } from "vscode-languageserver/node"

import { Herb } from "@herb-tools/node-wasm"

import { UserSettings, PersonalHerbSettings } from "./user_settings"
import { Capabilities } from "./capabilities"
import { WorkspaceFolders } from "./workspace_folders"
import { Documents } from "./documents"
import { DiagnosticsPublisher } from "./diagnostics_publisher"
import { ParserService, FoldingRangeProvider, DocumentHighlightProvider, HoverProvider, RewriteCodeActionProvider, CommentProvider, DocumentSymbolProvider, ExtractCodeActionProvider, DefinitionProvider } from "@herb-tools/language-service"
import { ConfigService } from "./config_service"
import { SaveOrchestrator } from "./save_orchestrator"


import { Projects } from "./projects"

import type { LinterWarning } from "./linter_service"

const OPEN_CONFIG_ACTION = "Open .herb.yml"

export class Session {
  connection: Connection
  capabilities: Capabilities
  userSettings: UserSettings
  workspaceFolders: WorkspaceFolders
  projects: Projects

  diagnostics: DiagnosticsPublisher
  documents: Documents
  parserService: ParserService
  configService: ConfigService
  saveOrchestrator: SaveOrchestrator
  foldingRangeProvider: FoldingRangeProvider
  documentHighlightProvider: DocumentHighlightProvider
  hoverProvider: HoverProvider
  rewriteCodeActionProvider: RewriteCodeActionProvider
  extractCodeActionProvider: ExtractCodeActionProvider
  definitionProvider: DefinitionProvider
  commentProvider: CommentProvider
  documentSymbolProvider: DocumentSymbolProvider

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.capabilities = new Capabilities(params)
    this.userSettings = new UserSettings(this.connection, this.capabilities)
    this.workspaceFolders = new WorkspaceFolders(params)
    this.documents = new Documents(this.connection)
    this.parserService = new ParserService(Herb)
    this.configService = new ConfigService(this.workspaceFolders.primary)
    this.definitionProvider = new DefinitionProvider(
      this.parserService,
      existsSync,
      filePath => {
        try {
          return readFileSync(filePath, "utf-8")
        } catch {
          return null
        }
      },
      documentPath => this.viewRootFor(documentPath),
    )

    this.projects = new Projects(this.connection, this.workspaceFolders, {
      documents: this.documents,
      parserService: this.parserService,
      definitionProvider: this.definitionProvider,
      userSettings: this.userSettings,
      capabilities: this.capabilities,
    })

    this.diagnostics = new DiagnosticsPublisher(this.connection, this.documents, this.parserService, this.configService, this.workspaceFolders, this.projects, warning => this.showWarning(warning))
    this.saveOrchestrator = new SaveOrchestrator(this.connection, this.projects)
    this.foldingRangeProvider = new FoldingRangeProvider(this.parserService)
    this.documentHighlightProvider = new DocumentHighlightProvider(this.parserService)
    this.hoverProvider = new HoverProvider(this.parserService, process.cwd())
    this.rewriteCodeActionProvider = new RewriteCodeActionProvider(this.parserService, process.cwd())
    this.commentProvider = new CommentProvider(this.parserService)
    this.documentSymbolProvider = new DocumentSymbolProvider(this.parserService)

    this.extractCodeActionProvider = new ExtractCodeActionProvider(this.parserService, this.capabilities, existsSync)

    if (params.initializationOptions) {
      this.userSettings.global = params.initializationOptions as PersonalHerbSettings
    }
  }

  /**
   * Surfaces a linter warning, offering to open the config that caused it when
   * the client can navigate there.
   */
  private showWarning(warning: LinterWarning) {
    if (!this.capabilities.hasShowDocument) {
      this.connection.window.showWarningMessage(warning.message)

      return
    }

    this.connection.window.showWarningMessage(warning.message, { title: OPEN_CONFIG_ACTION }).then(action => {
      if (action?.title === OPEN_CONFIG_ACTION) {
        this.connection.window.showDocument({ uri: `file://${warning.configPath}`, takeFocus: true })
      }
    })
  }

  private viewRootFor(documentPath: string): string | null {
    const project = this.projects.containing(documentPath)
    const viewRoot = project?.partialIndexService.index?.viewRoot

    if (!project || viewRoot === undefined) return null

    return viewRoot === "." ? project.root : join(project.root, viewRoot)
  }

  async init() {
    this.connection.console.log(`[Client] Diagnostic related information: ${this.capabilities.hasDiagnosticRelatedInformation ? "supported" : "not supported"}`)

    await Herb.load()

    this.documents.onDidClose((change) => {
      this.userSettings.forget(change.document.uri)
      this.saveOrchestrator.forget(change.document.uri)
      this.diagnostics.clear(change.document.uri)
    })

    this.documents.onDidChangeContent(async (change) => {
      const project = await this.projects.ensure(change.document.uri)

      if (project) {
        const callersChanged = project.partialCallerIndexService.updateFromSource(change.document.uri, change.document.getText())
        const partialsChanged = project.partialIndexService.updateFromSource(change.document.uri, change.document.getText())

        if (callersChanged || partialsChanged) {
          await this.diagnostics.refreshAllDocuments()

          return
        }
      }

      await this.diagnostics.refreshDocument(change.document)
    })
  }

  async refresh() {
    this.projects.forget()

    for (const project of this.projects.all()) {
      await project.reindex()
    }

    await this.diagnostics.refreshAllDocuments()
  }

  async refreshConfig() {
    this.projects.forget()

    for (const project of this.projects.all()) {
      await project.refreshConfig()
    }
  }
}
