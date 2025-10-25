import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  InitializeResult,
  Connection,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  CodeActionParams,
} from "vscode-languageserver/node"

import { Service } from "./service"
import { HerbSettings } from "./settings"

import { HERB_FILES_GLOB } from "@herb-tools/core"

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

      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
          codeActionProvider: true,
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
        // Register for all configuration changes.
        this.connection.client.register(DidChangeConfigurationNotification.type, undefined)
      }

      if (this.service.settings.hasWorkspaceFolderCapability) {
        this.connection.workspace.onDidChangeWorkspaceFolders((_event) => {
          this.connection.console.log("Workspace folder change event received.")
        })
      }

      this.connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [
          { globPattern: HERB_FILES_GLOB },
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
        ) as HerbSettings
      }

      await this.service.refresh()
    })

    this.connection.onDidOpenTextDocument(async (params) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (document) {
        await this.service.diagnostics.refreshDocument(document)
      }
    })

    this.connection.onDidChangeWatchedFiles((params) => {
      params.changes.forEach(async (event) => {
        if (event.uri.endsWith("/.herb-lsp/config.json")) {
          await this.service.refreshConfig()

          const documents = this.service.documentService.getAll()
          await Promise.all(documents.map(document =>
            this.service.diagnostics.refreshDocument(document)
          ))
        }
      })
    })

    this.connection.onDocumentFormatting((params: DocumentFormattingParams) => {
      return this.service.formatting.formatDocument(params)
    })

    this.connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams) => {
      return this.service.formatting.formatRange(params)
    })

    this.connection.onCodeAction((params: CodeActionParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) {
        return []
      }

      const diagnostics = params.context.diagnostics
      const documentText = document.getText()

      return this.service.codeActionService.createCodeActions(
        params.textDocument.uri,
        diagnostics,
        documentText
      )
    })
  }

  listen() {
    this.connection.listen()
  }
}
