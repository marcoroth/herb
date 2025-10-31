import { Connection, TextDocuments, DocumentFormattingParams, DocumentRangeFormattingParams, TextEdit, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Formatter, defaultFormatOptions } from "@herb-tools/formatter"
import { Project } from "./project"
import { Settings } from "./settings"
import { Config } from "@herb-tools/config"
import { version } from "../package.json"

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
      this.config = await Config.loadForEditor(this.project.projectPath, version)
      this.connection.console.log("Herb formatter initialized successfully")
    } catch (error) {
      this.connection.console.error(`Failed to initialize Herb formatter: ${error}`)
    }
  }

  async refreshConfig(config?: Config) {
    if (config) {
      this.config = config
    } else {
      try {
        this.config = await Config.loadForEditor(this.project.projectPath, version)
      } catch (error) {
        this.connection.console.error(`Failed to refresh Herb formatter config: ${error}`)
      }
    }
  }

  private shouldFormatFile(filePath: string): boolean {
    if (filePath.endsWith('.herb.yml')) return false
    if (!this.config) return true

    const relativePath = filePath.replace('file://', '').replace(this.project.projectPath + '/', '')
    return this.config.isFormatterEnabledForPath(relativePath)
  }

  private async getFormatterOptions(uri: string) {
    const settings = await this.settings.getDocumentSettings(uri)

    const projectFormatter = this.config?.formatter || {}

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
    if (params.textDocument.uri.endsWith('.herb.yml')) {
      return []
    }

    const settings = await this.settings.getDocumentSettings(params.textDocument.uri)

    if (settings?.formatter?.enabled === false) {
      return []
    }

    const filePath = params.textDocument.uri.replace(/^file:\/\//, '')

    if (!this.shouldFormatFile(filePath)) {
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
    if (params.textDocument.uri.endsWith('.herb.yml')) {
      return []
    }

    const filePath = params.textDocument.uri.replace(/^file:\/\//, '')

    if (!this.shouldFormatFile(filePath)) {
      return []
    }

    return this.performRangeFormatting(params)
  }

  async formatRangeIgnoreConfig(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    return this.performRangeFormatting(params)
  }
}
