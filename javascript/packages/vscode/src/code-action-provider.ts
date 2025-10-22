import * as vscode from 'vscode'

export class HerbCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    if (context.diagnostics.length === 0) {
      return []
    }

    const actions: vscode.CodeAction[] = []

    for (const diagnostic of context.diagnostics) {
      const source = typeof diagnostic.source === 'string' ? diagnostic.source.trim() : undefined

      if (!source || !source.includes('Herb')) {
        continue
      }

      let errorType = 'UNKNOWN_ERROR'
      if (typeof diagnostic.code === 'string' && diagnostic.code) {
        errorType = diagnostic.code
      } else if (diagnostic.code && typeof diagnostic.code === 'object' && 'value' in diagnostic.code) {
        errorType = String(diagnostic.code.value)
      } else {
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
