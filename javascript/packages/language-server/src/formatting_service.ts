import { Connection, TextDocuments, DocumentFormattingParams, TextEdit, Range, Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Formatter } from "@herb-tools/formatter"
import { Project } from "./project"

export class FormattingService {
  private connection: Connection
  private documents: TextDocuments<TextDocument>
  private project: Project
  private formatter?: Formatter

  constructor(connection: Connection, documents: TextDocuments<TextDocument>, project: Project) {
    this.connection = connection
    this.documents = documents
    this.project = project
  }

  async initialize() {
    try {
      this.formatter = new Formatter(this.project.herbBackend, {
        indentWidth: 2,
        maxLineLength: 80
      })
      this.connection.console.log("Herb formatter initialized successfully")
    } catch (error) {
      this.connection.console.error(`Failed to initialize Herb formatter: ${error}`)
    }
  }

  async formatDocument(params: DocumentFormattingParams): Promise<TextEdit[]> {
    const document = this.documents.get(params.textDocument.uri)
    if (!document) {
      return []
    }

    if (!this.formatter) {
      this.connection.console.warn("Formatter not initialized, skipping formatting")

      return []
    }

    try {
      const text = document.getText()
      const newText = this.formatter.format(text)

      // If the formatted text is the same as the original, no changes needed
      if (newText === text) {
        return []
      }

      // Create a text edit that replaces the entire document
      const range: Range = {
        start: Position.create(0, 0),
        end: Position.create(document.lineCount, 0)
      }

      return [{
        range,
        newText
      }]
    } catch (error) {
      this.connection.console.error(`Formatting failed: ${error}`)
      return []
    }
  }
}
