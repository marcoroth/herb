import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"

import { LinterService } from "../src/linter_service"
import { Settings } from "../src/settings"
import { Herb } from "@herb-tools/node-wasm"

import type { Connection, InitializeParams, TextDocuments } from "vscode-languageserver/node"
import { Project } from "../src/project"

describe("LinterService", () => {
  let documents: TextDocuments<TextDocument>
  let connection: Connection
  let project: Project

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(() => {
    connection = {
      console: {
        log: vi.fn(),
        error: vi.fn()
      }
    } as unknown as Connection

    documents = {
      get: vi.fn()
    } as unknown as TextDocuments<TextDocument>

    project = {
      projectPath: '/test/project',
      herbBackend: Herb
    } as unknown as Project
  })

  const mockConnection = {
    workspace: {
      getConfiguration: vi.fn()
    }
  } as unknown as Connection

  const mockParams: InitializeParams = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  }

  const createTestDocument = (content: string) => {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  describe("lintDocument", () => {
    test("handles null settings gracefully", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue(null)

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<div>Test</div>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result).toBeDefined()
      expect(result.diagnostics).toEqual([])
    })

    test("handles undefined linter settings", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        formatter: { enabled: true }
        // linter is undefined
      })

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<div>Test</div>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result).toBeDefined()
      expect(result.diagnostics).toBeDefined()
    })

    test("respects linter.enabled = false", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: false }
      })

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<DIV>Test</DIV>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toEqual([])
    })

    test("lints when linter.enabled = true", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<DIV><SPAN>Hello</SPAN></DIV>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("uses default settings when no configuration is provided", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.hasConfigurationCapability = false

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<DIV>Test</DIV>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("filters out parser-no-errors rule by default to avoid duplicate diagnostics", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<h2>Content<h3>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toBeDefined()

      const parserErrorDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "parser-no-errors"
      )

      expect(parserErrorDiagnostics).toHaveLength(0)
    })

    test("respects custom excludedRules configuration", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: {
          enabled: true,
          excludedRules: ["html-tag-name-lowercase", "parser-no-errors"]
        }
      })

      const linterService = new LinterService(connection, project, settings)
      const textDocument = createTestDocument("<DIV>Content</DIV>")

      const result = await linterService.lintDocument(textDocument)

      const lowercaseDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "html-tag-name-lowercase"
      )

      expect(lowercaseDiagnostics).toHaveLength(0)
    })

    test('should ignore anchor issues due to excluded rule', async () => {
      const settings = new Settings(mockParams, mockConnection)
      const textDocument = createTestDocument('<a>Click me</a>')
      const linterService = new LinterService(connection, project, settings)


      vi.spyOn(linterService, 'getLinterOptions' as any).mockReturnValue({
          enabled: true,
          excludedRules: ["parser-no-errors", "html-anchor-require-href"]
      });

      const result = await linterService.lintDocument(textDocument)

      const requiredAnchorDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "html-anchor-require-href"
      )

      expect(requiredAnchorDiagnostics).toHaveLength(0)
    })
  })
})
