import { Connection, InitializeParams } from "vscode-languageserver/node"

import { Herb } from "@herb-tools/node-wasm"

import { Settings, PersonalHerbSettings } from "./settings"
import { DocumentService } from "./document_service"
import { Diagnostics } from "./diagnostics"
import { ParserService } from "./parser_service"
import { ConfigService } from "./config_service"
import { DocumentSaveService } from "./document_save_service"
import { FoldingRangeService } from "./folding_range_service"
import { DocumentHighlightService } from "./document_highlight_service"
import { HoverService } from "./hover_service"
import { RewriteCodeActionService } from "./rewrite_code_action_service"
import { ExtractCodeActionService } from "./extract_code_action_service"
import { DefinitionService } from "./definition_service"
import { CommentService } from "./comment_service"
import { DocumentSymbolService } from "./document_symbol_service"
import { Workspaces } from "./workspaces"

export class Service {
  connection: Connection
  settings: Settings
  workspaces: Workspaces

  diagnostics: Diagnostics
  documentService: DocumentService
  parserService: ParserService
  configService: ConfigService
  documentSaveService: DocumentSaveService
  foldingRangeService: FoldingRangeService
  documentHighlightService: DocumentHighlightService
  hoverService: HoverService
  rewriteCodeActionService: RewriteCodeActionService
  extractCodeActionService: ExtractCodeActionService
  definitionService: DefinitionService
  commentService: CommentService
  documentSymbolService: DocumentSymbolService

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.parserService = new ParserService()
    this.configService = new ConfigService(this.settings.projectPath)
    this.definitionService = new DefinitionService(this.parserService)

    this.workspaces = new Workspaces(this.connection, this.settings, {
      documentService: this.documentService,
      parserService: this.parserService,
      definitionService: this.definitionService,
    })

    this.diagnostics = new Diagnostics(this.connection, this.documentService, this.parserService, this.configService, this.settings, this.workspaces)
    this.documentSaveService = new DocumentSaveService(this.connection, this.settings, this.workspaces)
    this.foldingRangeService = new FoldingRangeService(this.parserService)
    this.documentHighlightService = new DocumentHighlightService(this.parserService)
    this.hoverService = new HoverService(this.parserService)
    this.rewriteCodeActionService = new RewriteCodeActionService(this.parserService)
    this.commentService = new CommentService(this.parserService)
    this.documentSymbolService = new DocumentSymbolService(this.parserService)

    this.extractCodeActionService = new ExtractCodeActionService(this.parserService, {
      supportsCreateFile: this.settings.supportsResourceCreation,
      supportsPromptCommand: this.settings.supportsExtractToPartialCommand,
    })

    if (params.initializationOptions) {
      this.settings.globalSettings = params.initializationOptions as PersonalHerbSettings
    }
  }

  async init() {
    this.connection.console.log(`[Client] Diagnostic related information: ${this.settings.hasDiagnosticRelatedInformationCapability ? "supported" : "not supported"}`)

    await Herb.load()

    this.documentService.onDidClose((change) => {
      this.settings.documentSettings.delete(change.document.uri)
      this.diagnostics.clear(change.document.uri)
    })

    this.documentService.onDidChangeContent(async (change) => {
      const workspace = await this.workspaces.ensure(change.document.uri)

      if (workspace) {
        const callersChanged = workspace.partialCallerIndexService.updateFromSource(change.document.uri, change.document.getText())
        const partialsChanged = workspace.partialIndexService.updateFromSource(change.document.uri, change.document.getText())

        if (callersChanged || partialsChanged) {
          await this.diagnostics.refreshAllDocuments()

          return
        }
      }

      await this.diagnostics.refreshDocument(change.document)
    })
  }

  async refresh() {
    this.workspaces.forget()

    for (const workspace of this.workspaces.all()) {
      await workspace.reindex()
    }

    await this.diagnostics.refreshAllDocuments()
  }

  async refreshConfig() {
    this.workspaces.forget()

    for (const workspace of this.workspaces.all()) {
      await workspace.refreshConfig()
    }
  }
}
