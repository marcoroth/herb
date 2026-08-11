import { ClientCapabilities, InitializeParams, ResourceOperationKind } from "vscode-languageserver/node"

import type { PersonalHerbSettings } from "./user_settings"

export interface HerbInitializationOptions extends PersonalHerbSettings {
  experimental?: {
    extractToPartialCommand?: boolean
  }
}

/**
 * What the connected client told us it can do, as reported once in `initialize`.
 * Every answer the server tailors to a client belongs here rather than being
 * re-derived from `InitializeParams` at the call site.
 */
export class Capabilities {
  readonly params: InitializeParams
  readonly client: ClientCapabilities

  readonly hasConfiguration: boolean
  readonly hasWorkspaceFolders: boolean
  readonly hasDiagnosticRelatedInformation: boolean
  readonly hasShowDocument: boolean

  constructor(params: InitializeParams) {
    this.params = params
    this.client = params.capabilities

    this.hasConfiguration = !!this.client.workspace?.configuration
    this.hasWorkspaceFolders = !!this.client.workspace?.workspaceFolders
    this.hasShowDocument = !!this.client.window?.showDocument
    this.hasDiagnosticRelatedInformation = !!this.client.textDocument?.publishDiagnostics?.relatedInformation
  }

  get supportsDefinitionLinks(): boolean {
    return this.client.textDocument?.definition?.linkSupport === true
  }

  get supportsResourceCreation(): boolean {
    return this.client.workspace?.workspaceEdit?.resourceOperations?.includes(ResourceOperationKind.Create) ?? false
  }

  get supportsExtractToPartialCommand(): boolean {
    const options = this.params.initializationOptions as HerbInitializationOptions | undefined | null

    return options?.experimental?.extractToPartialCommand === true
  }
}
