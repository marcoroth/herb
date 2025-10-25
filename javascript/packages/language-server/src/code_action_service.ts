import { CodeAction, CodeActionKind, Diagnostic, Range, TextEdit, WorkspaceEdit } from "vscode-languageserver/node"

export class CodeActionService {
  createCodeActions(uri: string, diagnostics: Diagnostic[], documentText: string): CodeAction[] {
    const actions: CodeAction[] = []

    for (const diagnostic of diagnostics) {
      if (diagnostic.source === "Herb Linter " && diagnostic.data?.rule) {
        const ruleName = diagnostic.data.rule as string

        const disableLineAction = this.createDisableLineAction(
          uri,
          diagnostic,
          ruleName,
          documentText
        )

        if (disableLineAction) {
          actions.push(disableLineAction)
        }

        const disableAllAction = this.createDisableAllAction(
          uri,
          diagnostic,
          documentText
        )

        if (disableAllAction) {
          actions.push(disableAllAction)
        }
      }
    }

    return actions
  }

  private createDisableLineAction(uri: string, diagnostic: Diagnostic, ruleName: string, documentText: string): CodeAction | null {
    const line = diagnostic.range.start.line
    const edit = this.createDisableCommentEdit(uri, line, ruleName, documentText)

    if (!edit) return null

    const action: CodeAction = {
      title: `Herb: Disable \`${ruleName}\` for this line`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit,
    }

    return action
  }

  private createDisableAllAction(uri: string, diagnostic: Diagnostic, documentText: string): CodeAction | null {
    const line = diagnostic.range.start.line
    const edit = this.createDisableCommentEdit(uri, line, "all", documentText)

    if (!edit) return null

    const action: CodeAction = {
      title: "Herb: Disable all linter rules for this line",
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit,
    }

    return action
  }

  private createDisableCommentEdit(uri: string, line: number, ruleName: string, documentText: string): WorkspaceEdit | null {
    const lines = documentText.split("\n")

    if (line >= lines.length) return null

    const lineText = lines[line]
    const existingDisableMatch = lineText.match(/<%#\s*herb:disable\s+(.+?)\s*%>/)

    let textEdit: TextEdit

    if (existingDisableMatch) {
      const existingRules = existingDisableMatch[1].split(",").map(r => r.trim())

      if (existingRules.includes("all") || ruleName === "all") {
        if (existingRules.includes("all")) {
          return null
        }

        textEdit = TextEdit.replace(
          Range.create(line, 0, line, lineText.length),
          lineText.replace(/<%#\s*herb:disable\s+.+?\s*%>/, "<%# herb:disable all %>")
        )
      } else {
        if (existingRules.includes(ruleName)) {
          return null
        }

        const newRules = [...existingRules, ruleName].join(", ")

        textEdit = TextEdit.replace(
          Range.create(line, 0, line, lineText.length),
          lineText.replace(/<%#\s*herb:disable\s+.+?\s*%>/, `<%# herb:disable ${newRules} %>`)
        )
      }
    } else {
      const disableComment = ruleName === "all"
        ? " <%# herb:disable all %>"
        : ` <%# herb:disable ${ruleName} %>`

      textEdit = TextEdit.replace(
        Range.create(line, 0, line, lineText.length),
        lineText + disableComment
      )
    }

    const workspaceEdit: WorkspaceEdit = {
      changes: {
        [uri]: [textEdit]
      }
    }

    return workspaceEdit
  }
}
