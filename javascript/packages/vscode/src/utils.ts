import * as vscode from "vscode"
import * as path from "path"
import { promises as fs } from "fs"

export interface EnvironmentInfo {
  extensionVersion: string
  vscodeVersion: string
  platform: string
  nodeVersion: string
}

export interface PersonalHerbSettings {
  vscodeSettings: {
    'linter.enabled': boolean | undefined
    'trace.server': string | undefined
  }
  projectConfig: string | null
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

export async function getHerbSettings(): Promise<PersonalHerbSettings> {
  const config = vscode.workspace.getConfiguration('languageServerHerb')

  const vscodeSettings = {
    'linter.enabled': config.get('linter.enabled') as boolean | undefined,
    'trace.server': config.get('trace.server') as string | undefined
  }

  let projectConfig: string | null = null

  try {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (workspaceRoot) {
      const configPath = path.join(workspaceRoot, '.herb.yml')
      projectConfig = await fs.readFile(configPath, 'utf8')
    }
  } catch (_error) {
    projectConfig = null
  }

  return {
    vscodeSettings,
    projectConfig
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
