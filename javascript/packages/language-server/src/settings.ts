import { ClientCapabilities, Connection, InitializeParams } from "vscode-languageserver/node"
import { defaultFormatOptions } from "@herb-tools/formatter"
import { Config } from "@herb-tools/config"
import { version } from "../package.json"

export interface PersonalHerbSettings {
  trace?: {
    server?: string
  }
  linter?: {
    enabled?: boolean
  }
  formatter?: {
    enabled?: boolean
    indentWidth?: number
    maxLineLength?: number
  }
}

export class Settings {

  defaultSettings: PersonalHerbSettings = {
    linter: {
      enabled: true
    },
    formatter: {
      enabled: false,
      indentWidth: defaultFormatOptions.indentWidth,
      maxLineLength: defaultFormatOptions.maxLineLength
    }
  }
  globalSettings: PersonalHerbSettings = this.defaultSettings
  documentSettings: Map<string, Thenable<PersonalHerbSettings>> = new Map()
  projectConfig?: Config

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

  async initializeProjectConfig(config?: Config) {
    if (config) {
      this.projectConfig = config
      return
    }

    try {
      this.projectConfig = await Config.loadForEditor(this.projectPath, version)
    } catch (error) {
      this.connection.console.warn(`Failed to load project config: ${error}`)
      this.projectConfig = undefined
    }
  }

  async refreshProjectConfig(config?: Config) {
    await this.initializeProjectConfig(config)

    this.documentSettings.clear()
  }

  private mergeSettings(userSettings: PersonalHerbSettings, projectConfig?: Config): PersonalHerbSettings {
    if (!projectConfig) {
      return userSettings
    }

    return {
      trace: userSettings.trace,
      linter: {
        enabled: projectConfig.linter?.enabled ?? userSettings.linter?.enabled ?? this.defaultSettings.linter!.enabled!
      },
      formatter: {
        enabled: projectConfig.formatter?.enabled ?? userSettings.formatter?.enabled ?? this.defaultSettings.formatter!.enabled!,
        indentWidth: projectConfig.formatter?.indentWidth ?? userSettings.formatter?.indentWidth ?? this.defaultSettings.formatter!.indentWidth!,
        maxLineLength: projectConfig.formatter?.maxLineLength ?? userSettings.formatter?.maxLineLength ?? this.defaultSettings.formatter!.maxLineLength!
      }
    }
  }

  get projectPath(): string {
    const uri = this.params.workspaceFolders?.at(0)?.uri || ""

    return uri.replace(/^file:\/\//, "")
  }

  getDocumentSettings(resource: string): Thenable<PersonalHerbSettings> {
    if (!this.hasConfigurationCapability) {
      const merged = this.mergeSettings(this.globalSettings, this.projectConfig)

      return Promise.resolve(merged)
    }

    let result = this.documentSettings.get(resource)

    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: resource,
        section: "languageServerHerb",
      }).then((userSettings: PersonalHerbSettings) => {
        return this.mergeSettings(userSettings, this.projectConfig)
      })

      this.documentSettings.set(resource, result)
    }

    return result
  }
}
