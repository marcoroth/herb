import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Config } from "@herb-tools/config"

import { lintToDignosticSeverity } from "./utils"
import { version } from "../package.json"

/**
 * Configuration service for validation of .herb.yml configuration files
 */
export class ConfigService {
  private projectPath?: string

  constructor(projectPath?: string) {
    this.projectPath = projectPath
  }

  async validateDocument(document: TextDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = []

    if (!document.uri.endsWith('.herb.yml')) {
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
