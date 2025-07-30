import { describe, test, expect, vi, beforeAll } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"

import { LinterService } from "../src/linter_service"
import { Settings } from "../src/settings"
import { Herb } from "@herb-tools/node-wasm"

import type { Connection, InitializeParams } from "vscode-languageserver/node"

describe("LinterService", () => {
  beforeAll(async () => {
    await Herb.load()
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

      const linterService = new LinterService(settings)
      const parseResult = Herb.parse("<div>Test</div>")
      const document = parseResult.value
      const textDocument = createTestDocument("<div>Test</div>")

      const result = await linterService.lintDocument(document, textDocument)

      expect(result).toBeDefined()
      expect(result.diagnostics).toEqual([])
    })

    test("handles undefined linter settings", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        formatter: { enabled: true }
        // linter is undefined
      })

      const linterService = new LinterService(settings)
      const parseResult = Herb.parse("<div>Test</div>")
      const document = parseResult.value
      const textDocument = createTestDocument("<div>Test</div>")

      const result = await linterService.lintDocument(document, textDocument)

      expect(result).toBeDefined()
      expect(result.diagnostics).toBeDefined()
    })

    test("respects linter.enabled = false", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: false }
      })

      const linterService = new LinterService(settings)
      const parseResult = Herb.parse("<DIV>Test</DIV>")
      const document = parseResult.value
      const textDocument = createTestDocument("<DIV>Test</DIV>")

      const result = await linterService.lintDocument(document, textDocument)

      expect(result.diagnostics).toEqual([])
    })

    test("lints when linter.enabled = true", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(settings)
      const parseResult = Herb.parse("<DIV><SPAN>Hello</SPAN></DIV>")
      const document = parseResult.value
      const textDocument = createTestDocument("<DIV><SPAN>Hello</SPAN></DIV>")

      const result = await linterService.lintDocument(document, textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("uses default settings when no configuration is provided", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.hasConfigurationCapability = false

      const linterService = new LinterService(settings)
      const parseResult = Herb.parse("<DIV>Test</DIV>")
      const document = parseResult.value
      const textDocument = createTestDocument("<DIV>Test</DIV>")

      const result = await linterService.lintDocument(document, textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })
  })
})
