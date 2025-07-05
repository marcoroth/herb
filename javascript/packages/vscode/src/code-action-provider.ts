import * as vscode from 'vscode'

export class HerbCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    // Only provide actions for HTML+ERB files
    if (!document.fileName.endsWith('.html.erb')) {
      return actions
    }

    // Check if there are any diagnostics in the current range
    const diagnostics = context.diagnostics
    if (diagnostics.length === 0) {
      return actions
    }

    // Create a code action for each diagnostic
    for (const diagnostic of diagnostics) {
      // Extract error code from diagnostic.code
      let errorType = 'UNKNOWN_ERROR'
      if (typeof diagnostic.code === 'string' && diagnostic.code) {
        errorType = diagnostic.code
      } else if (diagnostic.code && typeof diagnostic.code === 'object' && 'value' in diagnostic.code) {
        errorType = String(diagnostic.code.value)
      } else {
        // Fallback: extract from message
        const codeMatch = diagnostic.message.match(/([A-Z_]+[A-Z0-9_]*)/)
        errorType = codeMatch ? codeMatch[1] : 'DIAGNOSTIC_ERROR'
      }

      const action = new vscode.CodeAction(
        `Herb: Report Issue with "${errorType}"`,
        vscode.CodeActionKind.QuickFix
      )

      action.command = {
        command: 'herb.reportDiagnosticIssue',
        title: 'Report Issue with Diagnostic',
        arguments: [document.uri, diagnostic]
      }

      action.isPreferred = false
      actions.push(action)
    }

    return actions
  }
}
