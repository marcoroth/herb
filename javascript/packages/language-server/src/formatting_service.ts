import { Connection, TextDocuments, DocumentFormattingParams, DocumentRangeFormattingParams, TextEdit, Range, Position } from "vscode-languageserver/node"
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

  private async performRangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    const document = this.documents.get(params.textDocument.uri)

    if (!document) {
      return []
    }

    try {
      const options = await this.getFormatterOptions(params.textDocument.uri)
      const formatter = new Formatter(this.project.herbBackend, options)

      const rangeText = document.getText(params.range)
      const lines = rangeText.split('\n')

      let minIndentLevel = Infinity

      for (const line of lines) {
        const trimmedLine = line.trim()

        if (trimmedLine !== '') {
          const indent = line.match(/^\s*/)?.[0] || ''
          const indentLevel = Math.floor(indent.length / options.indentWidth)

          minIndentLevel = Math.min(minIndentLevel, indentLevel)
        }
      }

      if (minIndentLevel === Infinity) {
        minIndentLevel = 0
      }

      let textToFormat = rangeText

      if (minIndentLevel > 0) {
        const minIndentString = ' '.repeat(minIndentLevel * options.indentWidth)

        textToFormat = lines.map(line => {
          if (line.trim() === '') {
            return line
          }

          return line.startsWith(minIndentString) ? line.slice(minIndentString.length) : line
        }).join('\n')
      }

      let formattedText = formatter.format(textToFormat, { ...options })

      if (minIndentLevel > 0) {
        const formattedLines = formattedText.split('\n')
        const indentString = ' '.repeat(minIndentLevel * options.indentWidth)

        formattedText = formattedLines.map((line, _index) => {
          if (line.trim() === '') {
            return line
          }

          return indentString + line
        }).join('\n')
      }

      if (!formattedText.endsWith('\n')) {
        formattedText += '\n'
      }

      if (formattedText === rangeText) {
        return []
      }

      return [{ range: params.range, newText: formattedText }]
    } catch (error) {
      this.connection.console.error(`Range formatting failed: ${error}`)

      return []
    }
  }

  async formatRange(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    const filePath = params.textDocument.uri.replace(/^file:\/\//, '')

    if (!(await this.shouldFormatFile(filePath))) {
      return []
    }

    return this.performRangeFormatting(params)
  }

  async formatRangeIgnoreConfig(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    return this.performRangeFormatting(params)
  }
}
