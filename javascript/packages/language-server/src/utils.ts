import { DiagnosticSeverity } from "vscode-languageserver/node"
import type { LintSeverity } from "@herb-tools/linter"

export function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

export function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function lintToDignosticSeverity(severity: LintSeverity): DiagnosticSeverity {
  switch (severity) {
    case "error": return DiagnosticSeverity.Error
    case "warning": return DiagnosticSeverity.Warning
    case "info": return DiagnosticSeverity.Information
    case "hint": return DiagnosticSeverity.Hint
  }
}
