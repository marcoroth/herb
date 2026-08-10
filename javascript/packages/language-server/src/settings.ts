import { ClientCapabilities, Connection, InitializeParams, ResourceOperationKind, WorkspaceFoldersChangeEvent } from "vscode-languageserver/node"
import { Config } from "@herb-tools/config"

import { defaultFormatOptions } from "@herb-tools/formatter"
import { pathFromUri } from "./utils"
import { version } from "../package.json"

const FILE_SCHEME = "file://"

// TODO: ideally we could just Config all the way through
export interface PersonalHerbSettings {
  trace?: {
    server?: string
  }
  linter?: {
    enabled?: boolean
    fixOnSave?: boolean
  }
  formatter?: {
    enabled?: boolean
    indentWidth?: number
    indentStyle?: "space" | "tab"
    maxLineLength?: number
  }
}

export interface HerbInitializationOptions extends PersonalHerbSettings {
  experimental?: {
    extractToPartialCommand?: boolean
  }
}

export class Settings {
  defaultSettings: PersonalHerbSettings = {
    linter: {
      enabled: true,
      fixOnSave: true
    },
    formatter: {
      enabled: false,
      indentWidth: defaultFormatOptions.indentWidth,
      indentStyle: defaultFormatOptions.indentStyle,
      maxLineLength: defaultFormatOptions.maxLineLength
    }
  }
  globalSettings: PersonalHerbSettings = this.defaultSettings
  documentSettings: Map<string, Thenable<PersonalHerbSettings>> = new Map()
  projectConfig?: Config

  hasConfigurationCapability = false
  hasWorkspaceFolderCapability = false
  hasDiagnosticRelatedInformationCapability = false
  hasShowDocumentCapability = false

  params: InitializeParams
  capabilities: ClientCapabilities
  connection: Connection

  private folders: string[]

  constructor(params: InitializeParams, connection: Connection) {
    this.params = params
    this.capabilities = params.capabilities
    this.connection = connection

    const opened = params.workspaceFolders?.map(folder => folder.uri) ?? []

    this.folders = this.folderPaths(opened.length > 0 ? opened : [params.rootUri ?? params.rootPath ?? ""])

    this.hasConfigurationCapability = !!(this.capabilities.workspace && !!this.capabilities.workspace.configuration)
    this.hasShowDocumentCapability = !!(this.capabilities.window?.showDocument)

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

  // TODO: ideally we can just use Config all the way through
  private mergeSettings(userSettings: PersonalHerbSettings | null, projectConfig?: Config): PersonalHerbSettings {
    const settings = userSettings || this.defaultSettings
    const hasConfigFile = projectConfig ? Config.exists(projectConfig.projectPath) : false

    if (!projectConfig || !hasConfigFile) {
      return {
        trace: settings.trace,
        linter: {
          enabled: settings.linter?.enabled ?? this.defaultSettings.linter!.enabled!,
          fixOnSave: settings.linter?.fixOnSave ?? this.defaultSettings.linter!.fixOnSave!
        },
        formatter: {
          enabled: settings.formatter?.enabled ?? this.defaultSettings.formatter!.enabled!,
          indentWidth: settings.formatter?.indentWidth ?? this.defaultSettings.formatter!.indentWidth!,
          indentStyle: settings.formatter?.indentStyle ?? this.defaultSettings.formatter!.indentStyle!,
          maxLineLength: settings.formatter?.maxLineLength ?? this.defaultSettings.formatter!.maxLineLength!
        }
      }
    }

    return {
      trace: settings.trace,
      linter: {
        enabled: projectConfig.isLinterEnabled,
        fixOnSave: settings.linter?.fixOnSave ?? this.defaultSettings.linter!.fixOnSave!
      },
      formatter: {
        enabled: projectConfig.isFormatterEnabled,
        indentWidth: projectConfig.formatter?.indentWidth ?? this.defaultSettings.formatter!.indentWidth!,
        indentStyle: projectConfig.formatter?.indentStyle ?? this.defaultSettings.formatter!.indentStyle!,
        maxLineLength: projectConfig.formatter?.maxLineLength ?? this.defaultSettings.formatter!.maxLineLength!
      }
    }
  }

  get supportsDefinitionLinks(): boolean {
    return this.capabilities.textDocument?.definition?.linkSupport === true
  }

  get supportsResourceCreation(): boolean {
    return this.capabilities.workspace?.workspaceEdit?.resourceOperations?.includes(ResourceOperationKind.Create) ?? false
  }

  get supportsExtractToPartialCommand(): boolean {
    const options = this.params.initializationOptions as HerbInitializationOptions | undefined | null

    return options?.experimental?.extractToPartialCommand === true
  }

  get projectPath(): string {
    const uri = this.params.workspaceFolders?.at(0)?.uri ?? this.params.rootUri ?? this.params.rootPath ?? ""

    return uri.replace(/^file:\/\//, "")
  }

  get workspacePaths(): string[] {
    return this.folders
  }

  updateWorkspaceFolders(event: WorkspaceFoldersChangeEvent) {
    const removed = new Set(this.folderPaths(event.removed.map(folder => folder.uri)))

    this.folders = [
      ...this.folders.filter(path => !removed.has(path)),
      ...this.folderPaths(event.added.map(folder => folder.uri)),
    ]
  }

  includes(uri: string): boolean {
    if (!uri.startsWith(FILE_SCHEME)) return true
    if (this.folders.length === 0) return true

    return this.containsPath(pathFromUri(uri))
  }

  containsPath(path: string): boolean {
    return this.folders.some(root => path === root || path.startsWith(`${root}/`))
  }

  private folderPaths(uris: string[]): string[] {
    return uris.filter(uri => uri !== "").map(uri => pathFromUri(uri).replace(/\/$/, ""))
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
