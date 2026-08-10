import { Config } from "@herb-tools/config"
import { Herb, HerbBackend } from "@herb-tools/node-wasm"

import { ConfigService } from "./config_service"
import { LinterService } from "./linter_service"
import { AutofixService } from "./autofix_service"
import { CodeActionProvider } from "./code_action_provider"
import { FormattingProvider } from "./formatting_provider"
import { ReferencesProvider } from "./references_provider"
import { CompletionProvider } from "./completion_provider"
import { PartialIndexService } from "./partial_index_service"
import { PartialCallerIndexService } from "./partial_caller_index_service"

import { version } from "../package.json"

import type { Connection } from "vscode-languageserver/node"
import type { UserSettings, PersonalHerbSettings } from "./user_settings"
import type { Capabilities } from "./capabilities"
import type { Documents } from "./documents"
import type { ParserService } from "./parser_service"
import type { DefinitionProvider } from "./definition_provider"

export interface SharedServices {
  documents: Documents
  parserService: ParserService
  definitionProvider: DefinitionProvider
  userSettings: UserSettings
  capabilities: Capabilities
}

export class Project {
  readonly root: string
  readonly herbBackend: HerbBackend

  config?: Config

  readonly configService: ConfigService
  readonly partialIndexService: PartialIndexService
  readonly partialCallerIndexService: PartialCallerIndexService
  readonly linterService: LinterService
  readonly autofixService: AutofixService
  readonly codeActionProvider: CodeActionProvider
  readonly formattingProvider: FormattingProvider
  readonly referencesProvider: ReferencesProvider
  readonly completionProvider: CompletionProvider

  private readonly connection: Connection
  private readonly userSettings: UserSettings

  constructor(connection: Connection, root: string, shared: SharedServices) {
    const { userSettings, capabilities } = shared

    this.connection = connection
    this.userSettings = userSettings
    this.root = root
    this.herbBackend = Herb

    this.configService = new ConfigService(root)
    this.partialIndexService = new PartialIndexService(connection, this)
    this.partialCallerIndexService = new PartialCallerIndexService(connection, this, this.partialIndexService)
    this.linterService = new LinterService(connection, userSettings, capabilities, this, this.partialIndexService, this.partialCallerIndexService)
    this.autofixService = new AutofixService(connection, undefined, this.partialIndexService, this.partialCallerIndexService)
    this.codeActionProvider = new CodeActionProvider(this, undefined, this.partialIndexService, this.partialCallerIndexService)
    this.formattingProvider = new FormattingProvider(connection, shared.documents, this, userSettings, capabilities)
    this.completionProvider = new CompletionProvider(shared.parserService, this.partialIndexService)

    this.referencesProvider = new ReferencesProvider(
      this,
      shared.definitionProvider,
      this.partialIndexService,
      this.partialCallerIndexService,
      shared.documents,
    )
  }

  async initialize() {
    await this.herbBackend.load()
    await this.loadConfig()
    await this.formattingProvider.initialize(this.config)
    await this.partialIndexService.initialize()
    await this.partialCallerIndexService.initialize()
  }

  async reindex() {
    await this.partialIndexService.initialize()
    await this.partialCallerIndexService.initialize()
  }

  async loadConfig() {
    this.config = await this.readConfig()

    this.codeActionProvider.setConfig(this.config)
    this.autofixService.setConfig(this.config)
    this.linterService.setConfig(this.config)
    this.linterService.rebuildLinter()
  }

  async refreshConfig() {
    await this.loadConfig()
    await this.formattingProvider.refreshConfig(this.config)

    this.userSettings.forgetAll()
  }

  contains(path: string): boolean {
    return path === this.root || path.startsWith(`${this.root}/`)
  }

  /**
   * What a document in this project should actually be treated as, which is the
   * user's editor preferences with this project's `.herb.yml` layered over them.
   * A checked-in config is a decision the whole team made, so it wins over a
   * personal default for whether the linter and formatter run at all. Settings
   * that are only ever personal, like `fixOnSave`, stay with the user.
   */
  async settingsFor(uri: string): Promise<PersonalHerbSettings> {
    const settings = await this.userSettings.getDocumentSettings(uri)

    if (!this.config || !Config.exists(this.config.projectPath)) return settings

    return {
      ...settings,
      linter: {
        ...settings.linter,
        enabled: this.config.isLinterEnabled
      },
      formatter: {
        ...settings.formatter,
        enabled: this.config.isFormatterEnabled,
        indentWidth: this.config.formatter?.indentWidth ?? settings.formatter?.indentWidth,
        indentStyle: this.config.formatter?.indentStyle ?? settings.formatter?.indentStyle,
        maxLineLength: this.config.formatter?.maxLineLength ?? settings.formatter?.maxLineLength
      }
    }
  }

  private async readConfig(): Promise<Config> {
    try {
      const config = await Config.loadForEditor(this.root, version)

      if (config.version && config.version !== version) {
        this.connection.console.warn(
          `Config file version (${config.version}) does not match current version (${version}). ` +
          `Consider updating your .herb.yml file.`
        )
      }

      return config
    } catch (error) {
      this.connection.console.warn(
        `Failed to load config for ${this.root}: ${error instanceof Error ? error.message : String(error)}. Using personal settings with defaults.`
      )

      const globals: PersonalHerbSettings = this.userSettings.global

      return Config.fromObject({ linter: globals.linter, formatter: globals.formatter }, { projectPath: this.root, version })
    }
  }
}
