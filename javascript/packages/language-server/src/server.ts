import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  InitializeResult,
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
      completionProvider: { resolveProvider: true },
      codeActionProvider: true,
      definitionProvider: true,
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
      { globPattern: `**/**/*.{ts,js}` },
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

connection.onDefinition((params) => service.definitions.onDefinition(params))
connection.onCodeAction((params) => service.codeActions.onCodeAction(params))

connection.onCompletion((textDocumentPosition) => {
  const document = service.documentService.get(textDocumentPosition.textDocument.uri)

  if (!document) return null

  return service.htmlLanguageService.doComplete(
    document,
    textDocumentPosition.position,
    service.htmlLanguageService.parseHTMLDocument(document),
  )
})

// Listen on the connection
connection.listen()
