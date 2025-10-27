import { CodeAction, CodeActionKind, Diagnostic, Range, TextEdit, WorkspaceEdit, CreateFile, TextDocumentEdit, OptionalVersionedTextDocumentIdentifier } from "vscode-languageserver/node"
import { Config } from "@herb-tools/config"
import { Project } from "./project"

export class CodeActionService {
  private project: Project
  private config?: Config

  constructor(project: Project, config?: Config) {
    this.project = project
    this.config = config
  }

  setConfig(config: Config) {
    this.config = config
  }

  createCodeActions(uri: string, diagnostics: Diagnostic[], documentText: string): CodeAction[] {
    const actions: CodeAction[] = []
    const linesWithDisableAll = new Set<number>()
    const disableAllActions: CodeAction[] = []

    const linterDiagnostics = diagnostics.filter(diagnostic => diagnostic.source === "Herb Linter ")

    for (const diagnostic of linterDiagnostics) {
      const ruleName = (diagnostic.data?.rule as string) || (typeof diagnostic.code === 'string' ? diagnostic.code : undefined)
      if (!ruleName) continue

      const disableLineAction = this.createDisableLineAction(
        uri,
        diagnostic,
        ruleName,
        documentText
      )

      if (disableLineAction) {
        actions.push(disableLineAction)
      }

      const disableInConfigAction = this.createDisableInConfigAction(
        diagnostic,
        ruleName
      )

      if (disableInConfigAction) {
        actions.push(disableInConfigAction)
      }

      const line = diagnostic.range.start.line

      if (!linesWithDisableAll.has(line)) {
        const disableAllAction = this.createDisableAllAction(
          uri,
          diagnostic,
          documentText
        )

        if (disableAllAction) {
          disableAllActions.push(disableAllAction)
          linesWithDisableAll.add(line)
        }
      }
    }

    return actions.concat(disableAllActions)
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

  private createDisableInConfigAction(diagnostic: Diagnostic, ruleName: string): CodeAction | null {
    const edit = this.createConfigDisableEdit(ruleName)

    if (!edit) return null

    const projectPath = this.project.projectPath
    const configPath = Config.configPathFromProjectPath(projectPath)
    const configUri = `file://${configPath}`

    const action: CodeAction = {
      title: `Herb: Disable \`${ruleName}\` in \`.herb.yml\``,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit,
      command: {
        title: 'Open .herb.yml',
        command: 'vscode.open',
        arguments: [configUri]
      }
    }

    return action
  }

  private createConfigDisableEdit(ruleName: string): WorkspaceEdit | null {
    try {
      const projectPath = this.project.projectPath

      if (!projectPath) {
        return null
      }

      if (this.config?.config.linter?.rules?.[ruleName]?.enabled === false) {
        return null
      }

      const configPath = Config.configPathFromProjectPath(projectPath)
      const configUri = `file://${configPath}`

      const mutation = {
        linter: {
          rules: {
            [ruleName]: { enabled: false }
          }
        }
      }

      const configExists = Config.exists(configPath)
      let newContent = ''
      let textEdit: TextEdit

      if (configExists) {
        try {
          const existingYaml = Config.readRawYaml(configPath)

          newContent = Config.applyMutationToYamlString(existingYaml, mutation)

          const lines = existingYaml.split('\n')
          const endLine = lines.length
          const endCharacter = lines[lines.length - 1]?.length || 0

          textEdit = TextEdit.replace(
            Range.create(0, 0, endLine, endCharacter),
            newContent
          )
        } catch (error) {
          console.error('[Code Action] Error processing existing config:', error)
          return null
        }
      } else {
        try {
          newContent = Config.createConfigYamlString(mutation)

          textEdit = TextEdit.insert(
            { line: 0, character: 0 },
            newContent
          )
        } catch (error) {
          console.error('[Code Action] Error creating new config:', error)

          return null
        }
      }

      let workspaceEdit: WorkspaceEdit

      if (configExists) {
        workspaceEdit = {
          changes: {
            [configUri]: [textEdit]
          }
        }
      } else {
        const createFile: CreateFile = {
          kind: 'create',
          uri: configUri
        }

        const textDocumentEdit: TextDocumentEdit = {
          textDocument: OptionalVersionedTextDocumentIdentifier.create(configUri, null),
          edits: [textEdit]
        }

        workspaceEdit = {
          documentChanges: [createFile, textDocumentEdit]
        }
      }

      return workspaceEdit
    } catch (error) {
      console.error('[Code Action] Unexpected error:', error)
      return null
    }
  }
}
