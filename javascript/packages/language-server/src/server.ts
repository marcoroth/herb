import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  TextDocumentSaveReason,
  InitializeResult,
  Connection,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  CodeActionParams,
  CodeActionKind,
  FoldingRangeParams,
  DocumentHighlightParams,
  DocumentSymbolParams,
  HoverParams,
  CompletionParams,
  DefinitionParams,
  ReferenceParams,
  TextDocumentIdentifier,
  Range,
  FileChangeType,
} from "vscode-languageserver/node"

import { Service } from "./service"
import { DefinitionService } from "./definition_service"
import { PersonalHerbSettings } from "./settings"
import { Config } from "@herb-tools/config"
import { isPartialPath } from "@herb-tools/core"
import { isConfigDocument } from "./utils"
import { version } from "../package.json"

import type { FileEvent } from "vscode-languageserver/node"
import type { ExtractToPartialResult } from "./extract_code_action_service"

export class Server {
  private service!: Service
  private connection: Connection

  constructor() {
    this.connection = createConnection(ProposedFeatures.all)
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.connection.onInitialize(async (params: InitializeParams) => {
      this.service = new Service(this.connection, params)

      await this.service.init()

      this.service.documentService.documents.onWillSaveWaitUntil(async (event) => {
        return this.service.documentSaveService.applyFixes(event.document)
      })

      const result: InitializeResult = {
        serverInfo: {
          name: "Herb Language Server",
          version,
        },
        capabilities: {
          textDocumentSync: {
            openClose: true,
            change: TextDocumentSyncKind.Incremental,
            willSave: true,
            willSaveWaitUntil: true,
            save: {
              includeText: false
            }
          },
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
          codeActionProvider: {
            codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll, CodeActionKind.RefactorRewrite, CodeActionKind.RefactorExtract]
          },
          foldingRangeProvider: true,
          documentHighlightProvider: true,
          hoverProvider: true,
          completionProvider: {
            triggerCharacters: [".", ":", "<", "&", "\"", "'", "/", ",", " ", "@"],
          },
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
        },
      }

      if (this.service.settings.hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
          workspaceFolders: {
            supported: true,
            changeNotifications: true,
          },
        }
      }

      return result
    })

    this.connection.onInitialized(() => {
      if (this.service.settings.hasConfigurationCapability) {
        this.connection.client.register(DidChangeConfigurationNotification.type, undefined)
      }

      if (this.service.settings.hasWorkspaceFolderCapability) {
        this.connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
          this.service.settings.updateWorkspaceFolders(event)

          const dropped = this.service.workspaces.prune()

          this.connection.console.log(`[Workspace] Folders changed, dropped ${dropped.length} project(s)`)

          await this.service.diagnostics.refreshAllDocuments()
        })
      }

      const patterns = Config.getDefaultFilePatterns().map(globPattern => ({
        globPattern
      }))

      this.connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [
          ...patterns,
          { globPattern: `**/${Config.configPath}` },
          ...Config.misnamedConfigPaths.map(misnamedPath => ({ globPattern: `**/${misnamedPath}` })),
          { globPattern: `**/.herb/rules/**/*.mjs` },
          { globPattern: `**/.herb/rewriters/**/*.mjs` },
        ],
      })
    })

    this.connection.onDidChangeConfiguration(async (change) => {
      if (this.service.settings.hasConfigurationCapability) {
        // Reset all cached document settings
        this.service.settings.documentSettings.clear()
      } else {
        this.service.settings.globalSettings = (
          (change.settings.languageServerHerb || this.service.settings.defaultSettings)
        ) as PersonalHerbSettings
      }

      await this.service.refresh()
    })

    this.connection.onDidOpenTextDocument(async (params) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (document) {
        await this.service.diagnostics.refreshDocument(document)
      }
    })

    this.connection.onDidChangeWatchedFiles(async (params) => {
      for (const event of params.changes) {
        const isConfigChange = isConfigDocument(event.uri)
        const isCustomRuleChange = event.uri.includes("/.herb/rules/")
        const isCustomRewriterChange = event.uri.includes("/.herb/rewriters/")

        if (isConfigChange) {
          await this.service.refreshConfig()

          const documents = this.service.documentService.getAll()
          await Promise.all(documents.map(document =>
            this.service.diagnostics.refreshDocument(document)
          ))
        } else if (isCustomRuleChange || isCustomRewriterChange) {
          if (isCustomRuleChange) {
            this.connection.console.log(`[Linter] Custom rule changed: ${event.uri}`)
            for (const workspace of this.service.workspaces.all()) workspace.linterService.rebuildLinter()
          }

          if (isCustomRewriterChange) {
            this.connection.console.log(`[Rewriter] Custom rewriter changed: ${event.uri}`)
            for (const workspace of this.service.workspaces.all()) await workspace.formattingService.refreshConfig(workspace.config)
          }

          const documents = this.service.documentService.getAll()
          await Promise.all(documents.map(document =>
            this.service.diagnostics.refreshDocument(document)
          ))
        } else if (await this.updatePartialIndex(event)) {
          await this.service.diagnostics.refreshAllDocuments()
        }
      }
    })

    this.connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.documentSaveService.applyFixesAndFormatting(document, TextDocumentSaveReason.Manual)
    })

    this.connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams) => {
      return this.service.workspaces.get(params.textDocument.uri)?.formattingService.formatRange(params) ?? []
    })

    this.connection.onDocumentHighlight((params: DocumentHighlightParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.documentHighlightService.getDocumentHighlights(document, params.position)
    })

    this.connection.onHover((params: HoverParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return null

      return this.service.hoverService.getHover(document, params.position) ?? this.service.definitionService.getHover(document, params.position)
    })

    this.connection.onCompletion((params: CompletionParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return null

      return this.service.workspaces.get(params.textDocument.uri)?.completionService.getCompletions(document, params.position) ?? null
    })

    this.connection.onCodeAction((params: CodeActionParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      const workspace = this.service.workspaces.get(params.textDocument.uri)
      if (!workspace) return []

      const parseResult = this.service.parserService.parseDocument(document)
      if (parseResult.diagnostics.length > 0) return []

      const diagnostics = params.context.diagnostics
      const documentText = document.getText()

      const linterDisableCodeActions = workspace.codeActionService.createCodeActions(
        params.textDocument.uri,
        diagnostics,
        documentText
      )

      const autofixCodeActions = workspace.codeActionService.autofixCodeActions(params, document)
      const rewriteCodeActions = this.service.rewriteCodeActionService.getCodeActions(document, params.range)
      const extractCodeActions = this.service.extractCodeActionService.getCodeActions(document, params.range)

      return autofixCodeActions.concat(linterDisableCodeActions).concat(rewriteCodeActions).concat(extractCodeActions)
    })

    this.connection.onRequest<ExtractToPartialResult, void>('herb/extractToPartial', (params: { textDocument: TextDocumentIdentifier, range: Range, name: string }) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return { error: "The document isn't open." }

      return this.service.extractCodeActionService.extractToPartial(document, params.range, params.name)
    })

    this.connection.onDefinition((params: DefinitionParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      const links = this.service.definitionService.getDefinition(document, params.position)

      if (this.service.settings.supportsDefinitionLinks) return links

      return DefinitionService.asLocations(links)
    })

    this.connection.onReferences((params: ReferenceParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.workspaces.get(params.textDocument.uri)?.referencesService.getReferences(document, params.position, params.context.includeDeclaration) ?? []
    })

    this.connection.onDocumentSymbol((params: DocumentSymbolParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.documentSymbolService.getDocumentSymbols(document)
    })

    this.connection.onFoldingRanges((params: FoldingRangeParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.foldingRangeService.getFoldingRanges(document)
    })

    this.connection.onRequest('herb/toggleLineComment', (params: { textDocument: TextDocumentIdentifier, range: Range }) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.commentService.toggleLineComment(document, params.range)
    })

    this.connection.onRequest('herb/toggleBlockComment', (params: { textDocument: TextDocumentIdentifier, range: Range }) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.commentService.toggleBlockComment(document, params.range)
    })
  }

  private async updatePartialIndex(event: FileEvent): Promise<boolean> {
    const workspace = this.service.workspaces.get(event.uri)

    if (!workspace) {
      this.service.diagnostics.clear(event.uri)

      return false
    }

    const partials = workspace.partialIndexService
    const callers = workspace.partialCallerIndexService

    if (event.type === FileChangeType.Deleted) {
      const stoppedCalling = callers.remove(event.uri)

      this.service.diagnostics.clear(event.uri)

      return partials.remove(event.uri) || stoppedCalling
    }

    const isOpen = this.service.documentService.get(event.uri) !== undefined
    const changed = isOpen ? false : partials.updateFromDisk(event.uri)

    if (event.type === FileChangeType.Created && isPartialPath(event.uri)) {
      await callers.initialize()

      return true
    }

    if (!isOpen) {
      return callers.updateFromDisk(event.uri) || changed
    }

    return changed
  }

  listen() {
    this.connection.listen()
  }
}
