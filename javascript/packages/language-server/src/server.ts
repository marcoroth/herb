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

      this.service.documentService.documents.onWillSaveWaitUntil(async (event) => {
        this.connection.console.log(`[Server] willSaveWaitUntil called for ${event.document.uri}`)

        const settings = await this.service.settings.getDocumentSettings(event.document.uri)
        const formatterEnabled = settings?.formatter?.enabled ?? false
        const fixOnSave = settings?.linter?.fixOnSave ?? false

        let currentDocument = event.document
        if (fixOnSave) {
          const autofixEdits = await this.service.autofix.getAutofixEdits(currentDocument, event.reason)
          if (autofixEdits.length > 0) {
            const autofixedText = autofixEdits[0].newText
            currentDocument = {
              ...currentDocument,
              getText: () => autofixedText
            } as any
          }
        }

        if (formatterEnabled) {
          return this.service.formatting.formatOnSave(currentDocument, event.reason)
        }

        if (fixOnSave && currentDocument !== event.document) {
          return [{ range: { start: { line: 0, character: 0 }, end: { line: currentDocument.lineCount, character: 0 } }, newText: currentDocument.getText() }]
        }

        return []
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

    this.connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) {
        return []
      }

      const settings = await this.service.settings.getDocumentSettings(params.textDocument.uri)
      const fixOnSave = settings?.linter?.fixOnSave ?? false
      const formatterEnabled = settings?.formatter?.enabled ?? false

      if (fixOnSave) {
        this.connection.console.log(`[Server] Applying autofix${formatterEnabled ? ' before formatting' : ''}`)
        const autofixEdits = await this.service.autofix.getAutofixEdits(document, 1) // 1 = Manual save

        if (autofixEdits.length > 0) {
          if (formatterEnabled) {
            const autofixedText = autofixEdits[0].newText
            return this.service.formatting.formatDocumentWithAutofix(params, autofixedText)
          }

          return autofixEdits
        }
      }

      if (formatterEnabled) {
        return this.service.formatting.formatDocument(params)
      }

      return []
    })

    this.connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams) => {
      return this.service.formatting.formatRange(params)
    })

    this.connection.onCodeAction(async (params: CodeActionParams) => {
      const document = this.service.documentService.get(params.textDocument.uri)

      if (!document) {
        return []
      }

      return this.service.codeAction.getCodeActions(params, document)
    })
  }

  listen() {
    this.connection.listen()
  }
}
