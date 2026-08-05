import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Config } from "@herb-tools/config"

import { isConfigDocument, lintToDignosticSeverity } from "./utils"
import { version } from "../package.json"

/**
 * Configuration service for validation of .herb.yml configuration files
 */
export class ConfigService {
  private projectPath?: string

  constructor(projectPath?: string) {
    this.projectPath = projectPath
  }

  private wholeDocumentRange(document: TextDocument): Range {
    const text = document.getText()

    if (text.length === 0) {
      return Range.create(0, 0, 0, 1)
    }

    const end = document.positionAt(text.length)

    return Range.create(0, 0, end.line, end.character)
  }

  async validateDocument(document: TextDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = []

    if (Config.isMisnamedConfigPath(document.uri)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: this.wholeDocumentRange(document),
        message: `Herb only reads \`${Config.configPath}\`, so this file is ignored. Rename it to \`${Config.configPath}\` to apply it.`,
        source: 'Herb Config ',
        code: 'wrong_file_extension'
      })

      return diagnostics
    }

    if (!isConfigDocument(document.uri)) {
      return diagnostics
    }

    const text = document.getText()

    const validationErrors = await Config.validateConfigText(text, {
      version,
      projectPath: this.projectPath
    })

    for (const error of validationErrors) {
      let line = error.line ?? 0
      let column = error.column ?? 0

      if (error.line === undefined && error.path.length > 0) {
        const searchKey = error.path[error.path.length - 1].toString()
        const lines = text.split('\n')

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(searchKey + ':')) {
            line = i
            column = lines[i].indexOf(searchKey)
            break
          }
        }
      }

      const path = error.path.join('.')
      const message = path ? `${path}: ${error.message}` : error.message
      const severity = error.severity ? lintToDignosticSeverity(error.severity) : DiagnosticSeverity.Error

      diagnostics.push({
        severity,
        range: Range.create(line, column, line, column + 20),
        message: message,
        source: 'Herb Config ',
        code: error.code
      })
    }

    return diagnostics
  }
}
