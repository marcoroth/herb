import { describe, test, expect, vi, beforeAll } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"

import { LinterService } from "../src/linter_service"
import { Settings } from "../src/settings"
import { Project } from "../src/project"
import { Herb } from "@herb-tools/node-wasm"

import type { Connection, InitializeParams } from "vscode-languageserver/node"

describe("LinterService", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const mockConnection = {
    workspace: {
      getConfiguration: vi.fn()
    },
    console: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  } as unknown as Connection

  const mockParams: InitializeParams = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  }

  const mockProject = {
    projectPath: process.cwd()
  } as Project

  const createTestDocument = (content: string) => {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  describe("lintDocument", () => {
    test("handles null settings gracefully", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue(null)

      const linterService = new LinterService(mockConnection, settings, mockProject)
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

      const linterService = new LinterService(mockConnection, settings, mockProject)
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

      const linterService = new LinterService(mockConnection, settings, mockProject)
      const textDocument = createTestDocument("<DIV>Test</DIV>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toEqual([])
    })

    test("lints when linter.enabled = true", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(mockConnection, settings, mockProject)
      const textDocument = createTestDocument("<DIV><SPAN>Hello</SPAN></DIV>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("uses default settings when no configuration is provided", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.hasConfigurationCapability = false

      const linterService = new LinterService(mockConnection, settings, mockProject)
      const textDocument = createTestDocument("<DIV>Test</DIV>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("filters out parser-no-errors rule by default to avoid duplicate diagnostics", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(mockConnection, settings, mockProject)
      const textDocument = createTestDocument("<h2>Content<h3>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toBeDefined()

      const parserErrorDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "parser-no-errors"
      )

      expect(parserErrorDiagnostics).toHaveLength(0)
    })

    test("respects custom disabled rules configuration", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      settings.projectConfig = {
        path: "/test/.herb.yml",
        config: {
          version: "0.8.2",
          linter: {
            enabled: true,
            rules: {
              "html-tag-name-lowercase": { enabled: false }
            }
          }
        },
        toJSON: () => "{}",
        getConfiguredSeverity: () => "error",
        applySeverityOverrides: (offenses) => offenses
      } as any

      const linterService = new LinterService(mockConnection, settings, mockProject)
      const textDocument = createTestDocument("<DIV>Content</DIV>")

      const result = await linterService.lintDocument(textDocument)

      const lowercaseDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "html-tag-name-lowercase"
      )

      expect(lowercaseDiagnostics).toHaveLength(0)
    })
  })
})
