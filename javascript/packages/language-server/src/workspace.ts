import { Config } from "@herb-tools/config"

import { Project } from "./project"
import { ConfigService } from "./config_service"
import { LinterService } from "./linter_service"
import { AutofixService } from "./autofix_service"
import { CodeActionService } from "./code_action_service"
import { FormattingService } from "./formatting_service"
import { ReferencesService } from "./references_service"
import { CompletionService } from "./completion_service"
import { PartialIndexService } from "./partial_index_service"
import { PartialCallerIndexService } from "./partial_caller_index_service"

import { version } from "../package.json"

import type { Connection } from "vscode-languageserver/node"
import type { Settings, PersonalHerbSettings } from "./settings"
import type { DocumentService } from "./document_service"
import type { ParserService } from "./parser_service"
import type { DefinitionService } from "./definition_service"

export interface SharedServices {
  documentService: DocumentService
  parserService: ParserService
  definitionService: DefinitionService
}

export class Workspace {
  readonly root: string
  readonly project: Project

  public config?: Config

  readonly configService: ConfigService
  readonly partialIndexService: PartialIndexService
  readonly partialCallerIndexService: PartialCallerIndexService
  readonly linterService: LinterService
  readonly autofixService: AutofixService
  readonly codeActionService: CodeActionService
  readonly formattingService: FormattingService
  readonly referencesService: ReferencesService
  readonly completionService: CompletionService

  private readonly connection: Connection
  private readonly settings: Settings

  constructor(connection: Connection, settings: Settings, root: string, shared: SharedServices) {
    this.connection = connection
    this.settings = settings
    this.root = root

    this.project = new Project(connection, root)
    this.configService = new ConfigService(root)
    this.partialIndexService = new PartialIndexService(connection, this.project)
    this.partialCallerIndexService = new PartialCallerIndexService(connection, this.project, this.partialIndexService)
    this.linterService = new LinterService(connection, settings, this.project, this.partialIndexService, this.partialCallerIndexService)
    this.autofixService = new AutofixService(connection, undefined, this.partialIndexService, this.partialCallerIndexService)
    this.codeActionService = new CodeActionService(this.project, undefined, this.partialIndexService, this.partialCallerIndexService)
    this.formattingService = new FormattingService(connection, shared.documentService.documents, this.project, settings)
    this.completionService = new CompletionService(shared.parserService, this.partialIndexService)

    this.referencesService = new ReferencesService(
      this.project,
      shared.definitionService,
      this.partialIndexService,
      this.partialCallerIndexService,
      shared.documentService,
    )
  }

  async initialize() {
    await this.project.initialize()
    await this.loadConfig()
    await this.formattingService.initialize()
    await this.formattingService.refreshConfig(this.config)
    await this.partialIndexService.initialize()
    await this.partialCallerIndexService.initialize()
  }

  async reindex() {
    await this.project.refresh()
    await this.partialIndexService.initialize()
    await this.partialCallerIndexService.initialize()
  }

  async loadConfig() {
    this.config = await this.readConfig()

    this.codeActionService.setConfig(this.config)
    this.autofixService.setConfig(this.config)
    this.linterService.setConfig(this.config)
    this.linterService.rebuildLinter()
  }

  async refreshConfig() {
    await this.loadConfig()
    await this.formattingService.refreshConfig(this.config)

    this.settings.documentSettings.clear()
  }

  contains(path: string): boolean {
    return path === this.root || path.startsWith(`${this.root}/`)
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

      const globals: PersonalHerbSettings = this.settings.globalSettings

      return Config.fromObject({ linter: globals.linter, formatter: globals.formatter }, { projectPath: this.root, version })
    }
  }
}
