import * as path from "path"

import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node"
import { Config } from "@herb-tools/config"

import type { Connection } from "vscode-languageserver/node"
import type { LintSeverity } from "@herb-tools/linter"
import type { DiagnosticSeverity as HerbDiagnosticSeverity, DiagnosticTag as HerbDiagnosticTag } from "@herb-tools/core"

export function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

export function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function lintToDignosticSeverity(severity: LintSeverity | HerbDiagnosticSeverity): DiagnosticSeverity {
  switch (severity) {
    case "error": return DiagnosticSeverity.Error
    case "warning": return DiagnosticSeverity.Warning
    case "info": return DiagnosticSeverity.Information
    case "hint": return DiagnosticSeverity.Hint
  }
}

export function showConfigWarningMessage(connection: Connection, message: string, projectPath: string, canShowDocument: boolean): void {
  if (!canShowDocument) {
    connection.window.showWarningMessage(message)

    return
  }

  const openConfigAction = `Open ${path.basename(Config.configPathFromProjectPath(projectPath))}`

  connection.window.showWarningMessage(message, { title: openConfigAction }).then(action => {
    if (action?.title === openConfigAction) {
      const configPath = Config.configPathFromProjectPath(projectPath)

      connection.window.showDocument({ uri: `file://${configPath}`, takeFocus: true })
    }
  })
}

export function lintToDignosticTags(tags?: HerbDiagnosticTag[]): DiagnosticTag[] {
  if (!tags) return []

  return tags.flatMap(tag => {
    switch (tag) {
      case "unnecessary": return [DiagnosticTag.Unnecessary]
      case "deprecated": return [DiagnosticTag.Deprecated]
      default: return []
    }
  })
}
