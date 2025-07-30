import { Connection, TextDocuments, DocumentFormattingParams, TextEdit, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Formatter, defaultFormatOptions } from "@herb-tools/formatter"
import { Project } from "./project"
import { Settings } from "./settings"
import { Config } from "./config"
import { glob } from "glob"

export class FormattingService {
  private connection: Connection
  private documents: TextDocuments<TextDocument>
  private project: Project
  private settings: Settings
  private config?: Config

  constructor(connection: Connection, documents: TextDocuments<TextDocument>, project: Project, settings: Settings) {
    this.connection = connection
    this.documents = documents
    this.project = project
    this.settings = settings
  }

  async initialize() {
    try {
      this.config = await Config.fromPathOrNew(this.project.projectPath)
      this.connection.console.log("Herb formatter initialized successfully")
    } catch (error) {
      this.connection.console.error(`Failed to initialize Herb formatter: ${error}`)
    }
  }

  async refreshConfig() {
    this.config = await Config.fromPathOrNew(this.project.projectPath)
  }

  private async shouldFormatFile(filePath: string): Promise<boolean> {
    if (!this.config?.options.formatter) {
      return true
    }

    const formatter = this.config.options.formatter

    // Check if formatting is disabled in project config
    if (formatter.enabled === false) {
      return false
    }

    // Check exclude patterns first
    if (formatter.exclude) {
      for (const pattern of formatter.exclude) {
        try {
          const matches = await new Promise<string[]>((resolve, reject) => {
            glob(pattern, { cwd: this.project.projectPath }).then(resolve).catch(reject)
          })

          if (Array.isArray(matches) && matches.some((match: string) => filePath.includes(match) || filePath.endsWith(match))) {
            return false
          }
        } catch (error) {
          continue
        }
      }
    }

    if (formatter.include && formatter.include.length > 0) {
      for (const pattern of formatter.include) {
        try {
          const matches = await new Promise<string[]>((resolve, reject) => {
            glob(pattern, { cwd: this.project.projectPath }).then(resolve).catch(reject)
          })
          if (Array.isArray(matches) && matches.some((match: string) => filePath.includes(match) || filePath.endsWith(match))) {
            return true
          }
        } catch (error) {
          continue
        }
      }

      return false
    }

    return true
  }

  private async getFormatterOptions(uri: string) {
    const settings = await this.settings.getDocumentSettings(uri)

    const projectFormatter = this.config?.options.formatter || {}

    return {
      indentWidth: projectFormatter.indentWidth ?? settings?.formatter?.indentWidth ?? defaultFormatOptions.indentWidth,
      maxLineLength: projectFormatter.maxLineLength ?? settings?.formatter?.maxLineLength ?? defaultFormatOptions.maxLineLength
    }
  }

  private async performFormatting(params: DocumentFormattingParams): Promise<TextEdit[]> {
    const document = this.documents.get(params.textDocument.uri)

    if (!document) {
      return []
    }

    try {
      const options = await this.getFormatterOptions(params.textDocument.uri)
      const formatter = new Formatter(this.project.herbBackend, options)

      const text = document.getText()
      let newText = formatter.format(text)

      if (!newText.endsWith('\n')) {
        newText = newText + '\n'
      }

      if (newText === text) {
        return []
      }

      const range: Range = {
        start: Position.create(0, 0),
        end: Position.create(document.lineCount, 0)
      }

      return [{ range, newText }]
    } catch (error) {
      this.connection.console.error(`Formatting failed: ${error}`)

      return []
    }
  }

  async formatDocument(params: DocumentFormattingParams): Promise<TextEdit[]> {
    const settings = await this.settings.getDocumentSettings(params.textDocument.uri)

    if (settings?.formatter?.enabled === false) {
      return []
    }

    const filePath = params.textDocument.uri.replace(/^file:\/\//, '')

    if (!(await this.shouldFormatFile(filePath))) {
      return []
    }

    return this.performFormatting(params)
  }

  async formatDocumentIgnoreConfig(params: DocumentFormattingParams): Promise<TextEdit[]> {
    return this.performFormatting(params)
  }
}
