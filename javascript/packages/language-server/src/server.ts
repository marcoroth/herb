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
  DocumentOnTypeFormattingParams,
  CodeActionParams,
  CodeActionKind,
  FoldingRangeParams,
  DocumentHighlightParams,
  SelectionRangeParams,
  InlayHintParams,
  DocumentSymbolParams,
  HoverParams,
  CompletionParams,
  DefinitionParams,
  ReferenceParams,
  TextDocumentIdentifier,
  Range,
  FileChangeType,
} from "vscode-languageserver/node"

import { Session } from "./session"
import { PersonalHerbSettings } from "./user_settings"
import { Config } from "@herb-tools/config"
import { isPartialPath } from "@herb-tools/analysis"
import { isConfigDocument, isPathInside } from "./utils"
import { serverVersion } from "./build_info"
import { ON_TYPE_FORMATTING_OPTIONS } from "./on_type_formatting"

import type { FileEvent } from "vscode-languageserver/node"
import type { ExtractToPartialResult } from "@herb-tools/language-service"
import { DefinitionProvider, pathFromUri } from "@herb-tools/language-service"

export class Server {
  private session!: Session
  private connection: Connection

  constructor() {
    this.connection = createConnection(ProposedFeatures.all)
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.connection.onInitialize(async (params: InitializeParams) => {
      this.session = new Session(this.connection, params)

      await this.session.init()

      this.session.documents.documents.onWillSaveWaitUntil(async (event) => {
        return this.session.saveOrchestrator.applyFixes(event.document)
      })

      const result: InitializeResult = {
        serverInfo: {
          name: "Herb Language Server",
          version: serverVersion,
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
          documentOnTypeFormattingProvider: ON_TYPE_FORMATTING_OPTIONS,
          codeActionProvider: {
            codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll, CodeActionKind.RefactorRewrite, CodeActionKind.RefactorExtract]
          },
          foldingRangeProvider: true,
          documentHighlightProvider: true,
          selectionRangeProvider: true,
          inlayHintProvider: true,
          hoverProvider: true,
          completionProvider: {
            triggerCharacters: [".", ":", "<", "&", "\"", "'", "/", ",", " ", "@"],
          },
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
        },
      }

      if (this.session.capabilities.hasWorkspaceFolders) {
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
      if (this.session.capabilities.hasConfiguration) {
        this.connection.client.register(DidChangeConfigurationNotification.type, undefined)
      }

      if (this.session.capabilities.hasWorkspaceFolders) {
        this.connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
          this.session.workspaceFolders.update(event)

          const dropped = this.session.projects.prune()

          this.connection.console.log(`[Project] Folders changed, dropped ${dropped.length} project(s)`)

          this.session.diagnostics.clearWhere(uri => dropped.some(root => isPathInside(pathFromUri(uri), root)))

          await this.session.diagnostics.refreshAllDocuments()
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
      if (this.session.capabilities.hasConfiguration) {
        // Reset all cached document settings
        this.session.userSettings.forgetAll()
      } else {
        this.session.userSettings.global = (
          (change.settings.languageServerHerb || this.session.userSettings.defaults)
        ) as PersonalHerbSettings
      }

      if (this.session.capabilities.supportsInlayHintRefresh) {
        await this.connection.languages.inlayHint.refresh()
      }

      await this.session.refresh()
    })

    this.connection.onDidChangeWatchedFiles(async (params) => {
      for (const event of params.changes) {
        const isConfigChange = isConfigDocument(event.uri)
        const isCustomRuleChange = event.uri.includes("/.herb/rules/")
        const isCustomRewriterChange = event.uri.includes("/.herb/rewriters/")

        if (isConfigChange) {
          await this.session.refreshConfig()

          const documents = this.session.documents.getAll()
          await Promise.all(documents.map(document =>
            this.session.diagnostics.refreshDocument(document)
          ))
        } else if (isCustomRuleChange || isCustomRewriterChange) {
          if (isCustomRuleChange) {
            this.connection.console.log(`[Linter] Custom rule changed: ${event.uri}`)
            for (const project of this.session.projects.all()) project.linterService.rebuildLinter()
          }

          if (isCustomRewriterChange) {
            this.connection.console.log(`[Rewriter] Custom rewriter changed: ${event.uri}`)
            for (const project of this.session.projects.all()) await project.formattingProvider.refreshConfig(project.config)
          }

          const documents = this.session.documents.getAll()
          await Promise.all(documents.map(document =>
            this.session.diagnostics.refreshDocument(document)
          ))
        } else if (await this.updatePartialIndex(event)) {
          await this.session.diagnostics.refreshAllDocuments()
        }
      }
    })

    this.connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.saveOrchestrator.applyFixesAndFormatting(document, TextDocumentSaveReason.Manual)
    })

    this.connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams) => {
      return this.session.projects.get(params.textDocument.uri)?.formattingProvider.formatRange(params) ?? []
    })

    this.connection.onDocumentOnTypeFormatting((params: DocumentOnTypeFormattingParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.onTypeFormattingProvider.getTextEdits(document, params.position, params.ch)
    })

    this.connection.onDocumentHighlight((params: DocumentHighlightParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.documentHighlightProvider.getDocumentHighlights(document, params.position)
    })

    this.connection.onHover((params: HoverParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return null

      return this.session.hoverProvider.getHover(document, params.position) ?? this.session.definitionProvider.getHover(document, params.position)
    })

    this.connection.onCompletion((params: CompletionParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return null

      return this.session.projects.get(params.textDocument.uri)?.completionProvider.getCompletions(document, params.position) ?? null
    })

    this.connection.onCodeAction(async (params: CodeActionParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      const project = this.session.projects.get(params.textDocument.uri)
      if (!project) return []

      const parseResult = this.session.parserService.parseDocument(document)
      if (parseResult.diagnostics.length > 0) return []

      const diagnostics = params.context.diagnostics
      const documentText = document.getText()

      const linterDisableCodeActions = project.codeActionProvider.createCodeActions(
        params.textDocument.uri,
        diagnostics,
        documentText
      )

      const autofixCodeActions = await project.codeActionProvider.autofixCodeActions(params, document)
      const rewriteCodeActions = this.session.rewriteCodeActionProvider.getCodeActions(document, params.range)
      const extractCodeActions = this.session.extractCodeActionProvider.getCodeActions(document, params.range)

      return autofixCodeActions.concat(linterDisableCodeActions).concat(rewriteCodeActions).concat(extractCodeActions)
    })

    this.connection.onRequest<ExtractToPartialResult, void>('herb/extractToPartial', (params: { textDocument: TextDocumentIdentifier, range: Range, name: string }) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return { error: "The document isn't open." }

      return this.session.extractCodeActionProvider.extractToPartial(document, params.range, params.name)
    })

    this.connection.onDefinition((params: DefinitionParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      const links = this.session.definitionProvider.getDefinition(document, params.position)

      if (this.session.capabilities.supportsDefinitionLinks) return links

      return DefinitionProvider.asLocations(links)
    })

    this.connection.onReferences((params: ReferenceParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.projects.get(params.textDocument.uri)?.referencesProvider.getReferences(document, params.position, params.context.includeDeclaration) ?? []
    })

    this.connection.onDocumentSymbol((params: DocumentSymbolParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.documentSymbolProvider.getDocumentSymbols(document)
    })

    this.connection.onFoldingRanges((params: FoldingRangeParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.foldingRangeProvider.getFoldingRanges(document)
    })

    this.connection.onSelectionRanges((params: SelectionRangeParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.selectionRangeProvider.getSelectionRanges(document, params.positions)
    })

    this.connection.languages.inlayHint.on(async (params: InlayHintParams) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      const settings = await this.session.userSettings.getDocumentSettings(params.textDocument.uri)

      if (!settings.inlayHints?.enabled) return []

      return this.session.inlayHintProvider.getInlayHints(document, {
        minimumLines: settings.inlayHints.minimumLines,
        maximumClasses: settings.inlayHints.maximumClasses
      })
    })

    this.connection.onRequest('herb/toggleLineComment', (params: { textDocument: TextDocumentIdentifier, range: Range }) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.commentProvider.toggleLineComment(document, params.range)
    })

    this.connection.onRequest('herb/toggleBlockComment', (params: { textDocument: TextDocumentIdentifier, range: Range }) => {
      const document = this.session.documents.get(params.textDocument.uri)

      if (!document) return []

      return this.session.commentProvider.toggleBlockComment(document, params.range)
    })
  }

  private async updatePartialIndex(event: FileEvent): Promise<boolean> {
    const project = this.session.projects.get(event.uri)

    if (!project) {
      this.session.diagnostics.clear(event.uri)

      return false
    }

    const index = project.index

    if (event.type === FileChangeType.Deleted) {
      this.session.diagnostics.clear(event.uri)

      return index.remove(event.uri)
    }

    if (event.type === FileChangeType.Created && isPartialPath(event.uri)) {
      await index.indexCallers()

      return true
    }

    if (this.session.documents.get(event.uri)) {
      return false
    }

    return index.handleChange(event.uri)
  }

  listen() {
    this.connection.listen()
  }
}
