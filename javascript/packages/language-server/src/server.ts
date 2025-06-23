import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentFormattingParams,
  TextEdit,
  Position,
  Range
} from "vscode-languageserver/node"

import { Service } from "./service"
import { HerbSettings } from "./settings"

let service: Service
const connection = createConnection(ProposedFeatures.all)

connection.onInitialize(async (params: InitializeParams) => {
  service = new Service(connection, params)
  await service.init()

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentFormattingProvider: true,
    },
  }

  if (service.settings.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    }
  }

  return result
})

connection.onInitialized(() => {
  if (service.settings.hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }

  if (service.settings.hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.")
    })
  }

  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: `**/**/*.html.erb` },
      { globPattern: `**/**/.herb-lsp/config.json` },
    ],
  })
})

connection.onDidChangeConfiguration((change) => {
  if (service.settings.hasConfigurationCapability) {
    // Reset all cached document settings
    service.settings.documentSettings.clear()
  } else {
    service.settings.globalSettings = (
      (change.settings.languageServerHerb || service.settings.defaultSettings)
    ) as HerbSettings
  }

  service.refresh()
})

connection.onDidOpenTextDocument((params) => {
  console.error(params)
  const document = service.documentService.get(params.textDocument.uri)

  if (document) {
    service.diagnostics.refreshDocument(document)
  }
})

connection.onDidChangeWatchedFiles((params) => {
  params.changes.forEach(async (event) => {
    if (event.uri.endsWith("/.herb-lsp/config.json")) {
      await service.refreshConfig()

      service.documentService.getAll().forEach((document) => {
        service.diagnostics.refreshDocument(document)
      })
    }
  })
})

connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
  const { textDocument } = params;

  const document = service.documentService.get(textDocument.uri)
  if (!document) return []

  const formatted = service.formatter.format(document.getText())

  const fullRange = Range.create(
    Position.create(0, 0),  // start of document
    Position.create(Number.MAX_VALUE, Number.MAX_VALUE)  // end of document
  )

  const edit: TextEdit = {
    range: fullRange,
    newText: formatted
  }

  return [
    edit
  ]
})

// Listen on the connection
connection.listen()
