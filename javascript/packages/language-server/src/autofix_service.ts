import { Connection, TextEdit } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "@herb-tools/linter"
import { Config } from "@herb-tools/config"

import { getFullDocumentRange } from "@herb-tools/language-service"
import { Project } from "./project"

import type { ProjectIndex } from "@herb-tools/analysis/node"

export class AutofixService {
  private connection: Connection
  private project: Project
  private linter: Linter
  private index?: ProjectIndex

  constructor(connection: Connection, project: Project, config?: Config, index?: ProjectIndex) {
    this.connection = connection
    this.project = project
    this.index = index
    this.linter = this.buildLinter(config)
  }

  setConfig(config: Config) {
    this.linter = this.buildLinter(config)
  }

  private buildLinter(config?: Config) {
    return Linter.from(Herb, config)
  }

  private async lintContextFor(uri: string) {
    const settings = await this.project.settingsFor(uri)

    return {
      fileName: this.index?.relativePathFor(uri) ?? uri,
      partials: this.index?.partials,
      partialCallers: this.index?.callers,
      indentWidth: settings?.formatter?.indentWidth,
      indentStyle: settings?.formatter?.indentStyle,
    }
  }

  async autofix(document: TextDocument): Promise<TextEdit[]> {
    try {
      const text = document.getText()
      const context = await this.lintContextFor(document.uri)
      const lintResult = this.linter.lint(text, context)
      const offensesToFix = lintResult.offenses

      if (offensesToFix.length === 0) return []

      const autofixResult = this.linter.autofix(text, context, offensesToFix)

      if (autofixResult.source === text) return []

      return [{ range: getFullDocumentRange(document), newText: autofixResult.source }]
    } catch (error) {
      this.connection.console.error(`[Autofix] Failed: ${error}`)

      return []
    }
  }
}
