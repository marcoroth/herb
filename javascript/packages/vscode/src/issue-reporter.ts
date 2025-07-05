import * as vscode from "vscode"
import dedent from "dedent"

import {
  getEnvironmentInfo,
  getHerbSettings,
  createGitHubIssueUrl,
  extractErrorCode,
  formatDiagnostics,
  EnvironmentInfo,
  HerbSettings
} from "./utils"

function createEnvironmentSection(env: EnvironmentInfo): string {
  return dedent`
    **Environment:**
    - VS Code Extension Version: ${env.extensionVersion}
    - VS Code Version: ${env.vscodeVersion}
    - Platform: ${env.platform}
    - Node Version: ${env.nodeVersion}
  `
}

function createSettingsSection(settings: HerbSettings): string {
  return dedent`
    **Herb Settings:**
    \`\`\`json
    ${JSON.stringify(settings, null, 2)}
    \`\`\`
  `
}

function createStandardIssueSection(): string {
  return dedent`
    **Description:**
    <!-- Please describe the issue you're experiencing -->

    **Steps to Reproduce:**
    1.
    2.
    3.

    **Expected Behavior:**
    <!-- What you expected to happen -->

    **Actual Behavior:**
    <!-- What actually happened -->

    **Additional Context:**
    <!-- Any additional context about the problem -->
  `
}

export async function reportIssue(item: any): Promise<void> {
  let uri: vscode.Uri

  if (item?.resourceUri) {
    uri = item.resourceUri
  } else if (item?.uri) {
    uri = item.uri
  } else {
    vscode.window.showErrorMessage('Unable to determine file for issue reporting')
    console.error('Report issue called with item:', item)
    return
  }

  const diagnostics = vscode.languages.getDiagnostics(uri)
  const env = getEnvironmentInfo()

  const issueTitle = `Issue report`
  const issueBody = dedent`
    ${createEnvironmentSection(env)}

    **Diagnostics:**
    ${formatDiagnostics(diagnostics)}

    ${createStandardIssueSection()}
  `

  const issueUrl = createGitHubIssueUrl(issueTitle, issueBody, ['bug', 'vscode-extension'])
  await vscode.env.openExternal(vscode.Uri.parse(issueUrl))
}

export async function reportDetailedIssue(item?: any): Promise<void> {
  let uri: vscode.Uri

  if (item?.resourceUri) {
    uri = item.resourceUri
  } else if (item?.uri) {
    uri = item.uri
  } else {
    const activeEditor = vscode.window.activeTextEditor

    if (!activeEditor || !activeEditor.document.fileName.endsWith('.html.erb')) {
      vscode.window.showErrorMessage('Please open an HTML+ERB file to report a detailed issue')
      return
    }

    uri = activeEditor.document.uri
  }

  const diagnostics = vscode.languages.getDiagnostics(uri)
  const env = getEnvironmentInfo()
  const settings = getHerbSettings()

  const issueTitle = `Detailed issue report`
  const issueBody = dedent`
    **File Content:**
    Please paste your HTML+ERB file content below to help us reproduce the issue:

    \`\`\`html+erb
    <!-- Paste your HTML+ERB file content here -->
    \`\`\`

    ${createEnvironmentSection(env)}

    ${createSettingsSection(settings)}

    **Diagnostics:**
    ${formatDiagnostics(diagnostics)}

    **Additional Context:**
    <!-- If you have any additional context about this issue, please describe it here -->
  `

  const issueUrl = createGitHubIssueUrl(issueTitle, issueBody, ['bug', 'vscode-extension', 'detailed-report'])
  await vscode.env.openExternal(vscode.Uri.parse(issueUrl))
}

export async function reportGeneralIssue(): Promise<void> {
  const env = getEnvironmentInfo()
  const settings = getHerbSettings()

  const issueTitle = `Issue with Herb VS Code Extension`
  const issueBody = dedent`
    ${createEnvironmentSection(env)}

    ${createSettingsSection(settings)}

    ${createStandardIssueSection()}
  `

  const issueUrl = createGitHubIssueUrl(issueTitle, issueBody, ['bug', 'vscode-extension'])
  await vscode.env.openExternal(vscode.Uri.parse(issueUrl))
}

export async function reportDiagnosticIssue(uri: vscode.Uri, diagnostic: vscode.Diagnostic): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri)
  const line = document.lineAt(diagnostic.range.start.line)
  const lineContent = line.text
  const lineNumber = diagnostic.range.start.line + 1

  const env = getEnvironmentInfo()
  const settings = getHerbSettings()
  const errorCode = extractErrorCode(diagnostic)

  const issueTitle = `Diagnostic issue: \`${errorCode}\``
  const issueBody = dedent`
    **Line:** ${lineNumber}
    **Diagnostic:** ${diagnostic.message}
    **Severity:** ${vscode.DiagnosticSeverity[diagnostic.severity]}

    **File Content:**
    Please paste your HTML+ERB file content below to help us reproduce the issue:

    \`\`\`html+erb
    <!-- Paste your HTML+ERB file content here -->
    \`\`\`

    **Problematic Line:**
    \`\`\`erb
    ${lineContent}
    \`\`\`

    ${createEnvironmentSection(env)}

    ${createSettingsSection(settings)}

    **Additional Context:**
    <!-- If you have any additional context about this issue, please describe it here -->
  `

  const issueUrl = createGitHubIssueUrl(issueTitle, issueBody, ['bug', 'vscode-extension', 'diagnostic-issue'])
  await vscode.env.openExternal(vscode.Uri.parse(issueUrl))
}
