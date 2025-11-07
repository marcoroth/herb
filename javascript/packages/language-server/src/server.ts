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
  TextEdit,
  FoldingRangeParams,
} from "vscode-languageserver/node"

import { Service } from "./service"
import { PersonalHerbSettings } from "./settings"
import { Config } from "@herb-tools/config"

import type { TextDocument } from "vscode-languageserver-textdocument"

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
        return this.service.documentSaveService.applyFixesAndFormatting(event.document, event.reason)
      })

      const result: InitializeResult = {
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
            codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll]
          },
          foldingRangeProvider: true,
        },
      }

      if (this.service.settings.hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
          workspaceFolders: {
            supported: true,
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
        this.connection.workspace.onDidChangeWorkspaceFolders((_event) => {
          this.connection.console.log("Workspace folder change event received.")
        })
      }

      const patterns = Config.getDefaultFilePatterns().map(globPattern => ({
        globPattern
      }))

      this.connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [
          ...patterns,
          { globPattern: `**/.herb.yml` },
          { globPattern: `**/**/.herb-lsp/config.json` },
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
        if (event.uri.endsWith("/.herb.yml") || event.uri.endsWith("/.herb-lsp/config.json")) {
          await this.service.refreshConfig()

          const documents = this.service.documentService.getAll()
          await Promise.all(documents.map(document =>
            this.service.diagnostics.refreshDocument(document)
          ))
        }
      }
    })

    this.connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      return this.service.documentSaveService.applyFixesAndFormatting(document, TextDocumentSaveReason.Manual)
    })

    this.connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams) => {
      return this.service.formattingService.formatRange(params)
    })

    this.connection.onCodeAction((params: CodeActionParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      const diagnostics = params.context.diagnostics
      const documentText = document.getText()

      const linterDisableCodeActions = this.service.codeActionService.createCodeActions(
        params.textDocument.uri,
        diagnostics,
        documentText
      )

      const autofixCodeActions = this.service.codeActionService.autofixCodeActions(params, document)

      return autofixCodeActions.concat(linterDisableCodeActions)
    })

    this.connection.onFoldingRanges((params: FoldingRangeParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) return []

      const parseResult = this.service.parserService.parseDocument(document)

      return this.service.foldingRangeService.getFoldingRanges(parseResult.document)
    })
  }

  listen() {
    this.connection.listen()
  }
}
