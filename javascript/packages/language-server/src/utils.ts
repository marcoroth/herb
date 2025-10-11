import { DiagnosticSeverity } from "vscode-languageserver/node"
import type { LintSeverity } from "@herb-tools/linter"

import { Position } from "vscode-languageserver/node"

import type { Range } from "vscode-languageserver/node"
import type { TextDocument } from "vscode-languageserver-textdocument"

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

/**
 * Returns a Range that spans the entire document
 */
export function getFullDocumentRange(document: TextDocument): Range {
  const lastLine = document.lineCount - 1
  const lastLineText = document.getText({
    start: Position.create(lastLine, 0),
    end: Position.create(lastLine + 1, 0)
  })
  const lastLineLength = lastLineText.length

  return {
    start: Position.create(0, 0),
    end: Position.create(lastLine, lastLineLength)
  }
}
