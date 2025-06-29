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
    if (!this.config?.options.formatting) {
      return true
    }

    const formatting = this.config.options.formatting

    // Check if formatting is disabled in project config
    if (formatting.enabled === false) {
      return false
    }

    // Check exclude patterns first
    if (formatting.exclude) {
      for (const pattern of formatting.exclude) {
        try {
          const matches = await new Promise<string[]>((resolve, reject) => {
            glob(pattern, { cwd: this.project.projectPath }, (err, matches) => {
              if (err) reject(err)
              else resolve(matches)
            })
          })

          if (Array.isArray(matches) && matches.some((match: string) => filePath.includes(match) || filePath.endsWith(match))) {
            return false
          }
        } catch (error) {
          continue
        }
      }
    }

    if (formatting.include && formatting.include.length > 0) {
      for (const pattern of formatting.include) {
        try {
          const matches = await new Promise<string[]>((resolve, reject) => {
            glob(pattern, { cwd: this.project.projectPath }, (err, matches) => {
              if (err) reject(err)
              else resolve(matches)
            })
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
    // Get VS Code settings
    const settings = await this.settings.getDocumentSettings(uri)

    // Get project config options
    const projectFormatting = this.config?.options.formatting || {}

    // Merge options with precedence: project config > VS Code settings > defaults
    return {
      indentWidth: projectFormatting.indentWidth ?? settings.formatting?.indentWidth ?? defaultFormatOptions.indentWidth,
      maxLineLength: projectFormatting.maxLineLength ?? settings.formatting?.maxLineLength ?? defaultFormatOptions.maxLineLength
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
      const newText = formatter.format(text)

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
    // Check VS Code settings first
    const settings = await this.settings.getDocumentSettings(params.textDocument.uri)

    if (settings.formatting?.enabled === false) {
      return []
    }

    // Check project config and file patterns
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
