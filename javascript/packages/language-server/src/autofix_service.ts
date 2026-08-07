import { Connection, TextEdit } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "@herb-tools/linter"
import { Config } from "@herb-tools/config"

import { getFullDocumentRange } from "./range_utils"
import { PartialIndexService } from "./partial_index_service"

export class AutofixService {
  private connection: Connection
  private linter: Linter
  private partialIndexService?: PartialIndexService

  constructor(connection: Connection, config?: Config, partialIndexService?: PartialIndexService) {
    this.connection = connection
    this.partialIndexService = partialIndexService
    this.linter = this.buildLinter(config)
  }

  setConfig(config: Config) {
    this.linter = this.buildLinter(config)
  }

  private buildLinter(config?: Config) {
    return Linter.from(Herb, config)
  }

  private lintContextFor(uri: string) {
    return {
      fileName: this.partialIndexService?.relativePathFor(uri) ?? uri,
      partials: this.partialIndexService?.index,
    }
  }

  async autofix(document: TextDocument): Promise<TextEdit[]> {
    try {
      const text = document.getText()
      const lintResult = this.linter.lint(text, this.lintContextFor(document.uri))
      const offensesToFix = lintResult.offenses

      if (offensesToFix.length === 0) return []

      const autofixResult = this.linter.autofix(text, this.lintContextFor(document.uri), offensesToFix)

      if (autofixResult.source === text) return []

      return [{ range: getFullDocumentRange(document), newText: autofixResult.source }]
    } catch (error) {
      this.connection.console.error(`[Autofix] Failed: ${error}`)

      return []
    }
  }
}
