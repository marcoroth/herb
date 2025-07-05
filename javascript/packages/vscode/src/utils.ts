import * as vscode from "vscode"

export interface EnvironmentInfo {
  extensionVersion: string
  vscodeVersion: string
  platform: string
  nodeVersion: string
}

export interface HerbSettings {
  'linter.enabled': boolean | undefined
  'trace.server': string | undefined
}

export function getEnvironmentInfo(): EnvironmentInfo {
  const extensionVersion = vscode.extensions.getExtension('marcoroth.herb-lsp')?.packageJSON.version || 'unknown'
  const vscodeVersion = vscode.version
  const platform = process.platform
  const nodeVersion = process.version

  return {
    extensionVersion,
    vscodeVersion,
    platform,
    nodeVersion
  }
}

export function getHerbSettings(): HerbSettings {
  const config = vscode.workspace.getConfiguration('languageServerHerb')
  return {
    'linter.enabled': config.get('linter.enabled'),
    'trace.server': config.get('trace.server')
  }
}

export function createGitHubIssueUrl(title: string, body: string, labels: string[] = []): string {
  const encodedTitle = encodeURIComponent(title)
  const encodedBody = encodeURIComponent(body)

  const labelsParam = labels.length > 0 ? `&labels=${labels.join(',')}` : ''
  return `https://github.com/marcoroth/herb/issues/new?title=${encodedTitle}&body=${encodedBody}${labelsParam}`
}

export function extractErrorCode(diagnostic: vscode.Diagnostic): string {
  if (typeof diagnostic.code === 'string' && diagnostic.code) {
    return diagnostic.code
  } else if (diagnostic.code && typeof diagnostic.code === 'object' && 'value' in diagnostic.code) {
    return String(diagnostic.code.value)
  } else {
    // Fallback: extract from message
    const codeMatch = diagnostic.message.match(/([A-Z_]+[A-Z0-9_]*)/)
    return codeMatch ? codeMatch[1] : 'DIAGNOSTIC_ERROR'
  }
}

export function formatDiagnostics(diagnostics: readonly vscode.Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'No diagnostics available'
  }

  return diagnostics.map(d => `- [${vscode.DiagnosticSeverity[d.severity]}] ${d.message} (line ${d.range.start.line + 1})`).join('\n')
}
