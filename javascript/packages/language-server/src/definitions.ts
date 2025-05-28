import { DefinitionParams } from "vscode-languageserver/node"
import { DocumentService } from "./document_service"

export class Definitions {
  private readonly documentService: DocumentService

  constructor(documentService: DocumentService) {
    this.documentService = documentService
  }

  onDefinition(_params: DefinitionParams) {
    return []
  }
}
