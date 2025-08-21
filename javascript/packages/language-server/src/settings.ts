import { ClientCapabilities, Connection, InitializeParams } from "vscode-languageserver/node"
import { defaultFormatOptions } from "@herb-tools/formatter"

export interface HerbSettings {
  trace?: {
    server?: string
  }
  linter?: {
    enabled?: boolean
    excludedRules?: string[]
  }
  formatter?: {
    enabled?: boolean
    indentWidth?: number
    maxLineLength?: number
  }
}

export class Settings {
  // The global settings, used when the `workspace/configuration` request is not supported by the client.
  // Please note that this is not the case when using this server with the client provided in this example
  // but could happen with other clients.
  defaultSettings: HerbSettings = {
    linter: {
      enabled: true,
      excludedRules: ["parser-no-errors"] // Default exclusion since parser errors are handled by ParserService
    },
    formatter: {
      enabled: false,
      indentWidth: defaultFormatOptions.indentWidth,
      maxLineLength: defaultFormatOptions.maxLineLength
    }
  }
  globalSettings: HerbSettings = this.defaultSettings
  documentSettings: Map<string, Thenable<HerbSettings>> = new Map()

  hasConfigurationCapability = false
  hasWorkspaceFolderCapability = false
  hasDiagnosticRelatedInformationCapability = false

  params: InitializeParams
  capabilities: ClientCapabilities
  connection: Connection

  constructor(params: InitializeParams, connection: Connection) {
    this.params = params
    this.capabilities = params.capabilities
    this.connection = connection

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    this.hasConfigurationCapability = !!(this.capabilities.workspace && !!this.capabilities.workspace.configuration)

    this.hasWorkspaceFolderCapability = !!(
      this.capabilities.workspace && !!this.capabilities.workspace.workspaceFolders
    )

    this.hasDiagnosticRelatedInformationCapability = !!(
      this.capabilities.textDocument &&
      this.capabilities.textDocument.publishDiagnostics &&
      this.capabilities.textDocument.publishDiagnostics.relatedInformation
    )
  }

  get projectPath(): string {
    return this.params.workspaceFolders?.at(0)?.uri || ""
  }

  getDocumentSettings(resource: string): Thenable<HerbSettings> {
    if (!this.hasConfigurationCapability) {
      return Promise.resolve(this.globalSettings)
    }

    let result = this.documentSettings.get(resource)

    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: resource,
        section: "languageServerHerb",
      })

      this.documentSettings.set(resource, result)
    }

    return result
  }
}
