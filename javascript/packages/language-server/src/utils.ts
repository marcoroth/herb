import * as path from "path"

import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node"
import { Config } from "@herb-tools/config"
import type { LintSeverity } from "@herb-tools/linter"
import type { DiagnosticSeverity as HerbDiagnosticSeverity, DiagnosticTag as HerbDiagnosticTag } from "@herb-tools/core"

export function isConfigDocument(uriOrPath: string): boolean {
  return path.basename(uriOrPath) === Config.configPath || Config.isMisnamedConfigPath(uriOrPath)
}

/**
 * Compares whole path segments, so `/app/foo` does not claim `/app/foo-bar`.
 */
export function isPathInside(filePath: string, root: string): boolean {
  return filePath === root || filePath.startsWith(`${root}/`)
}

export function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

export function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function lintToDiagnosticSeverity(severity: LintSeverity | HerbDiagnosticSeverity): DiagnosticSeverity {
  switch (severity) {
    case "error": return DiagnosticSeverity.Error
    case "warning": return DiagnosticSeverity.Warning
    case "info": return DiagnosticSeverity.Information
    case "hint": return DiagnosticSeverity.Hint
  }
}

export function lintToDiagnosticTags(tags?: HerbDiagnosticTag[]): DiagnosticTag[] {
  if (!tags) return []

  return tags.flatMap(tag => {
    switch (tag) {
      case "unnecessary": return [DiagnosticTag.Unnecessary]
      case "deprecated": return [DiagnosticTag.Deprecated]
      default: return []
    }
  })
}
