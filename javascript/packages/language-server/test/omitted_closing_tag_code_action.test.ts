import { describe, it, expect, beforeAll } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"
import { CodeActionKind, Diagnostic, DiagnosticSeverity, Range, Position } from "vscode-languageserver/node"

import { CodeActionService } from "../src/code_action_service"
import { Project } from "../src/project"
import { Herb } from "@herb-tools/node-wasm"

import type { CodeActionParams } from "vscode-languageserver/node"

describe("OmittedClosingTagError Code Action", () => {
  let codeActionService: CodeActionService

  beforeAll(async () => {
    await Herb.load()

    const mockProject = {
      projectPath: process.cwd()
    } as Project

    codeActionService = new CodeActionService(mockProject)
  })

  const createTestDocument = (content: string) => {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  const createOmittedClosingTagDiagnostic = (
    tagName: string,
    errorRange: Range,
    insertionPoint: { line: number; column: number },
    openingTagLocation: { line: number; column: number }
  ): Diagnostic => {
    return {
      source: "Herb Parser ",
      severity: DiagnosticSeverity.Error,
      range: errorRange,
      message: `Element \`<${tagName}>\` has its closing tag omitted.`,
      code: "OmittedClosingTagError",
      data: {
        error: {
          type: "OmittedClosingTagError",
          insertion_point: insertionPoint,
          opening_tag: {
            value: tagName,
            location: {
              start: openingTagLocation,
              end: { line: openingTagLocation.line, column: openingTagLocation.column + tagName.length }
            }
          }
        }
      }
    }
  }

  const createCodeActionParams = (document: TextDocument, diagnostics: Diagnostic[], range?: Range): CodeActionParams => {
    return {
      textDocument: { uri: document.uri },
      range: range || Range.create(Position.create(0, 0), Position.create(document.lineCount, 0)),
      context: { diagnostics }
    }
  }

  describe("insert closing tag action", () => {
    it("creates insert closing tag action for OmittedClosingTagError", () => {
      const content = "<ul>\n  <li>Item 1\n  <li>Item 2\n</ul>"
      const document = createTestDocument(content)

      const diagnostic = createOmittedClosingTagDiagnostic(
        "li",
        Range.create(Position.create(1, 2), Position.create(1, 6)),
        { line: 2, column: 2 },
        { line: 2, column: 3 }
      )

      const params = createCodeActionParams(document, [diagnostic])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toHaveLength(1)
      expect(actions[0].title).toBe("Insert closing tag `</li>`")
      expect(actions[0].kind).toBe(CodeActionKind.QuickFix)
    })

    it("creates correct text edit with insertion point", () => {
      const content = "<ul>\n  <li>Item\n</ul>"
      const document = createTestDocument(content)

      const diagnostic = createOmittedClosingTagDiagnostic(
        "li",
        Range.create(Position.create(1, 2), Position.create(1, 6)),
        { line: 3, column: 0 },
        { line: 2, column: 3 }
      )

      const params = createCodeActionParams(document, [diagnostic])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toHaveLength(1)
      expect(actions[0].edit).toBeDefined()
      expect(actions[0].edit?.changes).toBeDefined()

      const changes = actions[0].edit?.changes?.[document.uri]
      expect(changes).toHaveLength(1)
      expect(changes?.[0].newText).toBe("</li>")
      expect(changes?.[0].range.start.line).toBe(2)
      expect(changes?.[0].range.start.character).toBe(0)
    })

    it("returns empty array when no OmittedClosingTagError diagnostics", () => {
      const content = "<div><span>Hello</span></div>"
      const document = createTestDocument(content)

      const otherDiagnostic: Diagnostic = {
        source: "Herb Parser ",
        severity: DiagnosticSeverity.Error,
        range: Range.create(Position.create(0, 0), Position.create(0, 5)),
        message: "Some other error",
        code: "SomeOtherError"
      }

      const params = createCodeActionParams(document, [otherDiagnostic])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toEqual([])
    })

    it("returns empty array when diagnostics are from linter not parser", () => {
      const content = "<ul>\n  <li>Item\n</ul>"
      const document = createTestDocument(content)

      const linterDiagnostic: Diagnostic = {
        source: "Herb Linter ",
        severity: DiagnosticSeverity.Warning,
        range: Range.create(Position.create(1, 2), Position.create(1, 6)),
        message: "Some linter warning",
        code: "some-rule"
      }

      const params = createCodeActionParams(document, [linterDiagnostic])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toEqual([])
    })

    it("creates multiple actions for multiple omitted closing tags", () => {
      const content = "<ul>\n  <li>Item 1\n  <li>Item 2\n  <li>Item 3\n</ul>"
      const document = createTestDocument(content)

      const diagnostics = [
        createOmittedClosingTagDiagnostic(
          "li",
          Range.create(Position.create(1, 2), Position.create(1, 6)),
          { line: 2, column: 2 },
          { line: 2, column: 3 }
        ),
        createOmittedClosingTagDiagnostic(
          "li",
          Range.create(Position.create(2, 2), Position.create(2, 6)),
          { line: 3, column: 2 },
          { line: 3, column: 3 }
        ),
        createOmittedClosingTagDiagnostic(
          "li",
          Range.create(Position.create(3, 2), Position.create(3, 6)),
          { line: 4, column: 0 },
          { line: 4, column: 3 }
        )
      ]

      const params = createCodeActionParams(document, diagnostics)
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toHaveLength(3)
      actions.forEach(action => {
        expect(action.title).toBe("Insert closing tag `</li>`")
      })
    })

    it("only returns actions for diagnostics in requested range", () => {
      const content = "<ul>\n  <li>Item 1\n  <li>Item 2\n</ul>"
      const document = createTestDocument(content)

      const diagnostics = [
        createOmittedClosingTagDiagnostic(
          "li",
          Range.create(Position.create(1, 2), Position.create(1, 6)),
          { line: 2, column: 2 },
          { line: 2, column: 3 }
        ),
        createOmittedClosingTagDiagnostic(
          "li",
          Range.create(Position.create(2, 2), Position.create(2, 6)),
          { line: 3, column: 0 },
          { line: 3, column: 3 }
        )
      ]

      const range = Range.create(Position.create(1, 0), Position.create(1, 20))
      const params = createCodeActionParams(document, diagnostics, range)

      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toHaveLength(1)
    })

    it("includes diagnostic in the code action", () => {
      const content = "<ul>\n  <li>Item\n</ul>"
      const document = createTestDocument(content)

      const diagnostic = createOmittedClosingTagDiagnostic(
        "li",
        Range.create(Position.create(1, 2), Position.create(1, 6)),
        { line: 3, column: 0 },
        { line: 2, column: 3 }
      )

      const params = createCodeActionParams(document, [diagnostic])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toHaveLength(1)
      expect(actions[0].diagnostics).toHaveLength(1)
      expect(actions[0].diagnostics?.[0].code).toBe("OmittedClosingTagError")
    })

    it("handles missing error data gracefully", () => {
      const content = "<ul>\n  <li>Item\n</ul>"
      const document = createTestDocument(content)

      const diagnosticWithoutData: Diagnostic = {
        source: "Herb Parser ",
        severity: DiagnosticSeverity.Error,
        range: Range.create(Position.create(1, 2), Position.create(1, 6)),
        message: "Element `<li>` has its closing tag omitted.",
        code: "OmittedClosingTagError"
      }

      const params = createCodeActionParams(document, [diagnosticWithoutData])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toEqual([])
    })

    it("handles missing insertion_point gracefully", () => {
      const content = "<ul>\n  <li>Item\n</ul>"
      const document = createTestDocument(content)

      const diagnosticWithIncompleteData: Diagnostic = {
        source: "Herb Parser ",
        severity: DiagnosticSeverity.Error,
        range: Range.create(Position.create(1, 2), Position.create(1, 6)),
        message: "Element `<li>` has its closing tag omitted.",
        code: "OmittedClosingTagError",
        data: {
          error: {
            type: "OmittedClosingTagError",
            opening_tag: { value: "li" }
          }
        }
      }

      const params = createCodeActionParams(document, [diagnosticWithIncompleteData])
      const actions = codeActionService.parserErrorCodeActions(params, document)

      expect(actions).toEqual([])
    })
  })
})
