import { CodeAction, CodeActionParams } from "vscode-languageserver/node"

import { DocumentService } from "./document_service"

type Project = {}

export class CodeActions {
  private readonly documentService: DocumentService
  project: Project

  constructor(documentService: DocumentService, project: Project) {
    this.documentService = documentService
    this.project = project
  }

  onCodeAction(params: CodeActionParams): CodeAction[] {
    const { diagnostics } = params.context
    if (diagnostics.length === 0) return []

    const textDocument = this.documentService.get(params.textDocument.uri)
    if (textDocument === undefined) return []

    return []
  }
}
