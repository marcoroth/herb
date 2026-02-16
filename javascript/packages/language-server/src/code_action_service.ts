import { CodeAction, CodeActionKind, CodeActionParams, Diagnostic, Range, Position, TextEdit, WorkspaceEdit, CreateFile, TextDocumentEdit, OptionalVersionedTextDocumentIdentifier } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Config } from "@herb-tools/config"
import { Project } from "./project"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "@herb-tools/linter"

import { getFullDocumentRange } from "./utils"

import type { LintOffense } from "@herb-tools/linter"

export class CodeActionService {
  private project: Project
  private config?: Config
  private linter: Linter

  constructor(project: Project, config?: Config) {
    this.project = project
    this.config = config
    this.linter = Linter.from(Herb, config)
  }

  setConfig(config: Config) {
    this.config = config
    this.linter = Linter.from(Herb, config)
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

  parserErrorCodeActions(params: CodeActionParams, _document: TextDocument): CodeAction[] {
    const codeActions: CodeAction[] = []

    const parserDiagnostics = params.context.diagnostics.filter(diagnostic => {
      return diagnostic.source === "Herb Parser " && this.isInRange(diagnostic.range, params.range)
    })

    for (const diagnostic of parserDiagnostics) {
      if (diagnostic.code === "OmittedClosingTagError") {
        const action = this.createInsertClosingTagAction(params.textDocument.uri, diagnostic)

        if (action) {
          codeActions.push(action)
        }
      }
    }

    return codeActions
  }

  private createInsertClosingTagAction(uri: string, diagnostic: Diagnostic): CodeAction | null {
    const errorData = diagnostic.data?.error
    if (!errorData) return null

    const insertionPoint = errorData.insertion_point
    const openingTag = errorData.opening_tag

    if (!insertionPoint || !openingTag) return null

    const tagName = openingTag.value
    const closingTag = `</${tagName}>`
    const position = Position.create(insertionPoint.line - 1, insertionPoint.column)
    const textEdit = TextEdit.insert(position, closingTag)

    const workspaceEdit: WorkspaceEdit = {
      changes: {
        [uri]: [textEdit]
      }
    }

    return {
      title: `Insert closing tag \`</${tagName}>\``,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: workspaceEdit
    }
  }

  autofixCodeActions(params: CodeActionParams, document: TextDocument): CodeAction[] {
    if (this.config && !this.config.isLinterEnabled) {
      return []
    }

    const codeActions: CodeAction[] = []
    const text = document.getText()

    const lintResult = this.linter.lint(text, { fileName: document.uri })
    const offenses = lintResult.offenses

    const relevantDiagnostics = params.context.diagnostics.filter(diagnostic => {
      return diagnostic.source === "Herb Linter " && this.isInRange(diagnostic.range, params.range)
    })

    for (const diagnostic of relevantDiagnostics) {
      const offense = offenses.find(offense => this.rangesEqual(this.offenseToRange(offense), diagnostic.range) && offense.rule === diagnostic.code)

      if (!offense) {
        continue
      }

      const fixResult = this.linter.autofix(text, { fileName: document.uri }, [offense])

      if (fixResult.fixed.length > 0 && fixResult.source !== text) {
        const codeAction: CodeAction = {
          title: `Herb Linter: Fix "${offense.message}"`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit: this.createDocumentEdit(document, fixResult.source)
        }

        codeActions.push(codeAction)
      } else {
        const unsafeFixResult = this.linter.autofix(text, { fileName: document.uri }, [offense], { includeUnsafe: true })

        if (unsafeFixResult.fixed.length > 0 && unsafeFixResult.source !== text) {
          const codeAction: CodeAction = {
            title: `Herb Linter: Unsafely fix "${offense.message}"`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            edit: this.createDocumentEdit(document, unsafeFixResult.source)
          }

          codeActions.push(codeAction)
        }
      }
    }

    const allFixableOffenses = offenses.filter(offense => {
      const fixResult = this.linter.autofix(text, { fileName: document.uri }, [offense])

      return fixResult.fixed.length > 0
    })

    if (allFixableOffenses.length > 0) {
      const fixAllResult = this.linter.autofix(text, { fileName: document.uri }, allFixableOffenses)

      if (fixAllResult.fixed.length > 0 && fixAllResult.source !== text) {
        const fixAllAction: CodeAction = {
          title: `Herb Linter: Fix all ${fixAllResult.fixed.length} autocorrectable offense${fixAllResult.fixed.length === 1 ? '' : 's'}`,
          kind: CodeActionKind.SourceFixAll,
          edit: this.createDocumentEdit(document, fixAllResult.source)
        }

        codeActions.push(fixAllAction)
      }
    }

    return codeActions
  }


  private createDisableLineAction(uri: string, diagnostic: Diagnostic, ruleName: string, documentText: string): CodeAction | null {
    const line = diagnostic.range.start.line
    const edit = this.createDisableCommentEdit(uri, line, ruleName, documentText)

    if (!edit) return null

    const action: CodeAction = {
      title: `Herb Linter: Disable \`${ruleName}\` for this line`,
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
      title: "Herb Linter: Disable all linter rules for this line",
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
      title: `Herb Linter: Disable \`${ruleName}\` in \`.herb.yml\``,
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

      if (this.config?.isRuleDisabled(ruleName)) {
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

  private createDocumentEdit(document: TextDocument, newText: string): WorkspaceEdit {
    return {
      changes: {
        [document.uri]: [{
          range: getFullDocumentRange(document),
          newText
        }]
      }
    }
  }

  private offenseToRange(offense: LintOffense): Range {
    return {
      start: Position.create(offense.location.start.line - 1, offense.location.start.column),
      end: Position.create(offense.location.end.line - 1, offense.location.end.column)
    }
  }

  private rangesEqual(r1: Range, r2: Range): boolean {
    return (
      r1.start.line === r2.start.line &&
      r1.start.character === r2.start.character &&
      r1.end.line === r2.end.line &&
      r1.end.character === r2.end.character
    )
  }

  private isInRange(diagnosticRange: Range, requestedRange: Range): boolean {
    if (diagnosticRange.start.line > requestedRange.end.line) return false
    if (diagnosticRange.end.line < requestedRange.start.line) return false

    return true
  }
}
