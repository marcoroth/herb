import { Connection, TextDocuments } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

export class DocumentService {
  public documents: TextDocuments<TextDocument>
  document?: TextDocument

  constructor(connection: Connection) {
    this.documents = new TextDocuments(TextDocument)

    // Make the text document manager listen on the connection
    // for open, change and close text document events
    this.documents.listen(connection)
  }

  get(uri: string) {
    return this.documents.get(uri)
  }

  getAll() {
    return this.documents.all()
  }

  get onDidChangeContent() {
    return this.documents.onDidChangeContent
  }

  get onDidOpen() {
    return this.documents.onDidOpen
  }

  get onDidClose() {
    return this.documents.onDidClose
  }
}
