import { describe, test, expect, vi, beforeAll } from "vitest"

import { TextDocument } from "vscode-languageserver-textdocument"

import { LinterService } from "../src/linter_service"
import { UserSettings } from "../src/user_settings"
import { Capabilities } from "../src/capabilities"
import { Project } from "../src/project"
import { PartialIndexService } from "../src/partial_index_service"
import { PartialCallerIndexService } from "../src/partial_caller_index_service"
import { PartialCallerIndex } from "@herb-tools/core"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

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
    root: process.cwd()
  } as Project

  function projectFor(userSettings: UserSettings, root = process.cwd()): Project {
    return { root, settingsFor: (uri: string) => userSettings.getDocumentSettings(uri) } as unknown as Project
  }

  const capabilities = new Capabilities(mockParams)

  const partialIndexService = new PartialIndexService(mockConnection, mockProject)

  const createTestDocument = (content: string) => {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  describe("lintDocument", () => {
    test("handles null settings gracefully", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue(null)

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      const textDocument = createTestDocument("<div>Test</div>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result).toBeDefined()
      expect(result.diagnostics.filter(diagnostic => diagnostic.code !== "herb-config-framework-option")).toEqual([])
    })

    test("handles undefined linter settings", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        formatter: { enabled: true }
        // linter is undefined
      })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      const textDocument = createTestDocument("<div>Test</div>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result).toBeDefined()
      expect(result.diagnostics).toBeDefined()
    })

    test("respects linter.enabled = false", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: false }
      })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      const textDocument = createTestDocument("<DIV>Test</DIV>\n")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toEqual([])
    })

    test("lints when linter.enabled = true", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      const textDocument = createTestDocument("<DIV><SPAN>Hello</SPAN></DIV>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("uses default settings when no configuration is provided", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      const textDocument = createTestDocument("<DIV>Test</DIV>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)
    })

    test("filters out parser-no-errors rule by default to avoid duplicate diagnostics", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      const textDocument = createTestDocument("<h2>Content<h3>")

      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toBeDefined()

      const parserErrorDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "parser-no-errors"
      )

      expect(parserErrorDiagnostics).toHaveLength(0)
    })

    test("passes the configured framework through to the rules", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({ linter: { enabled: true } })

      const projectConfig = Config.fromObject({
        framework: "actionview",
        linter: { enabled: true, rules: {} }
      }, { projectPath: process.cwd() })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      linterService.setConfig(projectConfig)

      const result = await linterService.lintDocument(createTestDocument("<div>Test</div>\n"))

      expect(result.diagnostics.map(diagnostic => diagnostic.code)).not.toContain("herb-config-framework-option")
    })

    test("reports the missing framework option when the project doesn't configure one", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({ linter: { enabled: true } })

      const projectConfig = Config.fromObject({
        linter: { enabled: true, rules: {} }
      }, { projectPath: process.cwd() })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      linterService.setConfig(projectConfig)

      const result = await linterService.lintDocument(createTestDocument("<div>Test</div>\n"))

      expect(result.diagnostics.map(diagnostic => diagnostic.code)).toContain("herb-config-framework-option")
    })

    test("respects files.exclude patterns from config", async () => {
      vi.spyOn(Config, "exists").mockReturnValue(true)

      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const projectConfig = Config.fromObject({
        files: {
          exclude: ["vendor/**/*"]
        },
        linter: {
          enabled: true,
          rules: {}
        }
      }, { projectPath: "/test/project" })

      const mockProjectWithPath = {
        root: "/test/project"
      } as Project

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings, "/test/project"), new PartialIndexService(mockConnection, mockProjectWithPath))
      linterService.setConfig(projectConfig)
      const textDocument = TextDocument.create("file:///test/project/vendor/cache/file.html.erb", "erb", 1, "<DIV>Content</DIV>")
      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toEqual([])

      vi.restoreAllMocks()
    })

    test("respects linter.exclude patterns from config", async () => {
      vi.spyOn(Config, "exists").mockReturnValue(true)

      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const projectConfig = Config.fromObject({
        linter: {
          enabled: true,
          exclude: ["something/**/*"],
          rules: {}
        }
      }, { projectPath: "/test/project" })

      const mockProjectWithPath = {
        root: "/test/project"
      } as Project

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings, "/test/project"), new PartialIndexService(mockConnection, mockProjectWithPath))
      linterService.setConfig(projectConfig)
      const textDocument = TextDocument.create("file:///test/project/something/file.html.erb", "erb", 1, "<DIV>Content</DIV>")
      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics).toEqual([])

      vi.restoreAllMocks()
    })

    test("lints files not matching exclude patterns", async () => {
      vi.spyOn(Config, "exists").mockReturnValue(true)

      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const projectConfig = Config.fromObject({
        files: {
          exclude: ["vendor/**/*"]
        },
        linter: {
          enabled: true,
          rules: {}
        }
      }, { projectPath: "/test/project" })

      const mockProjectWithPath = {
        root: "/test/project"
      } as Project

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings, "/test/project"), new PartialIndexService(mockConnection, mockProjectWithPath))
      linterService.setConfig(projectConfig)
      const textDocument = TextDocument.create("file:///test/project/app/views/file.html.erb", "erb", 1, "<DIV>Content</DIV>")
      const result = await linterService.lintDocument(textDocument)

      expect(result.diagnostics.length).toBeGreaterThan(0)

      vi.restoreAllMocks()
    })

    test("respects custom disabled rules configuration", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({
        linter: { enabled: true }
      })

      const projectConfig = {
        path: "/test/.herb.yml",
        config: {
          version: "0.10.3",
          linter: {
            enabled: true,
            rules: {
              "html-tag-name-lowercase": { enabled: false }
            }
          }
        },
        toJSON: () => "{}",
        getConfiguredSeverity: () => "error",
        applySeverityOverrides: (offenses: any) => offenses
      } as any

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)
      linterService.setConfig(projectConfig)

      const textDocument = createTestDocument("<DIV>Content</DIV>")
      const result = await linterService.lintDocument(textDocument)

      const lowercaseDiagnostics = result.diagnostics.filter(
        diagnostic => diagnostic.code === "html-tag-name-lowercase"
      )

      expect(lowercaseDiagnostics).toHaveLength(0)
    })
  })

  describe("custom rule warnings", () => {
    test("reports a broken custom rule as data instead of talking to the client", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({ linter: { enabled: true } })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)

      linterService["failedCustomRules"].set("custom-rules", "boom")

      const result = await linterService.lintDocument(createTestDocument("<div>Test</div>\n"))

      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain("boom")
      expect(result.warnings[0].configPath).toContain(".herb.yml")
    })

    test("reports the same failure only once", async () => {
      const userSettings = new UserSettings(mockConnection, capabilities)
      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({ linter: { enabled: true } })

      const linterService = new LinterService(mockConnection, userSettings, capabilities, projectFor(userSettings), partialIndexService)

      linterService["failedCustomRules"].set("custom-rules", "boom")

      await linterService.lintDocument(createTestDocument("<div>Test</div>\n"))

      linterService["linter"] = undefined

      const second = await linterService.lintDocument(createTestDocument("<div>Test</div>\n"))

      expect(second.warnings).toEqual([])
    })
  })

  describe("cross-file rules", () => {
    const PARTIAL = "app/views/shared/_meta.html.erb"

    function callerServiceFor(callers: PartialCallerIndex): PartialCallerIndexService {
      const service = new PartialCallerIndexService(mockConnection, mockProject, partialIndexService)

      vi.spyOn(service, "index", "get").mockReturnValue(callers)

      return service
    }

    function clientWith(relatedInformation = true) {
      const capabilities = new Capabilities({
        ...mockParams,
        capabilities: relatedInformation ? { textDocument: { publishDiagnostics: { relatedInformation: true } } } : {}
      })

      const userSettings = new UserSettings(mockConnection, capabilities)

      userSettings.getDocumentSettings = vi.fn().mockResolvedValue({ linter: { enabled: true } })

      return { userSettings, capabilities }
    }

    test("reports an offense that only the call sites can justify", async () => {
      const callers = new PartialCallerIndex(
        new Map([[PARTIAL, [{ caller: "app/views/layouts/application.html.erb", locals: [], ancestors: ["html", "body"] }]]]),
        new Set(["app/views/layouts/application.html.erb"]),
        new Map(),
        new Set()
      )

      const client = clientWith()

      const service = new LinterService(mockConnection, client.userSettings, client.capabilities, projectFor(client.userSettings), partialIndexService, callerServiceFor(callers))

      vi.spyOn(partialIndexService, "relativePathFor").mockReturnValue(PARTIAL)

      const document = TextDocument.create(`file:///${PARTIAL}`, "erb", 1, `<meta charset="UTF-8">`)
      const result = await service.lintDocument(document)

      expect(result.diagnostics.some(diagnostic => diagnostic.code === "html-head-only-elements")).toBe(true)
    })

    test("stays silent for the same partial when no call site is known", async () => {
      const empty = new PartialCallerIndex(new Map(), new Set(), new Map(), new Set())
      const client = clientWith()
      const service = new LinterService(mockConnection, client.userSettings, client.capabilities, projectFor(client.userSettings), partialIndexService, callerServiceFor(empty))

      vi.spyOn(partialIndexService, "relativePathFor").mockReturnValue(PARTIAL)

      const document = TextDocument.create(`file:///${PARTIAL}`, "erb", 1, `<meta charset="UTF-8">`)
      const result = await service.lintDocument(document)

      expect(result.diagnostics.some(diagnostic => diagnostic.code === "html-head-only-elements")).toBe(false)
    })

    test("points at the call site that renders the file inside the element", async () => {
      const callers = new PartialCallerIndex(
        new Map([[PARTIAL, [{
          caller: "app/views/posts/index.html.erb",
          locals: [],
          ancestors: ["a"],
          via: "render" as const,
          location: { line: 12, column: 4 }
        }]]]),
        new Set(),
        new Map(),
        new Set()
      )

      const client = clientWith()

      const service = new LinterService(mockConnection, client.userSettings, client.capabilities, projectFor(client.userSettings), partialIndexService, callerServiceFor(callers))

      vi.spyOn(partialIndexService, "relativePathFor").mockReturnValue(PARTIAL)

      const document = TextDocument.create(`file:///${PARTIAL}`, "erb", 1, `<a href="/">link</a>`)
      const result = await service.lintDocument(document)

      const nested = result.diagnostics.find(diagnostic => diagnostic.code === "html-no-nested-links")

      expect(nested).toBeDefined()
      expect(nested?.relatedInformation).toHaveLength(1)
      expect(nested?.relatedInformation?.[0].location.uri).toContain("app/views/posts/index.html.erb")
      expect(nested?.relatedInformation?.[0].location.range.start.line).toBe(11)
      expect(nested?.relatedInformation?.[0].message).toBe("rendered from here inside <a>")
      expect(nested?.message).not.toContain("Rendered from")
    })

    test("omits related information when nothing rendered the file", async () => {
      const empty = new PartialCallerIndex(new Map(), new Set(), new Map(), new Set())
      const client = clientWith()
      const service = new LinterService(mockConnection, client.userSettings, client.capabilities, projectFor(client.userSettings), partialIndexService, callerServiceFor(empty))

      vi.spyOn(partialIndexService, "relativePathFor").mockReturnValue(PARTIAL)

      const document = TextDocument.create(`file:///${PARTIAL}`, "erb", 1, `<meta charset="UTF-8">`)
      const result = await service.lintDocument(document)

      expect(result.diagnostics.every(diagnostic => diagnostic.relatedInformation === undefined)).toBe(true)
    })

    test("names the call site in the message when the client cannot show related information", async () => {
      const callers = new PartialCallerIndex(
        new Map([[PARTIAL, [{
          caller: "app/views/posts/index.html.erb",
          locals: [],
          ancestors: ["a"],
          via: "render" as const,
          location: { line: 12, column: 4 }
        }]]]),
        new Set(),
        new Map(),
        new Set()
      )

      const client = clientWith(false)

      const service = new LinterService(mockConnection, client.userSettings, client.capabilities, projectFor(client.userSettings), partialIndexService, callerServiceFor(callers))

      vi.spyOn(partialIndexService, "relativePathFor").mockReturnValue(PARTIAL)

      const document = TextDocument.create(`file:///${PARTIAL}`, "erb", 1, `<a href="/">link</a>`)
      const result = await service.lintDocument(document)

      const nested = result.diagnostics.find(diagnostic => diagnostic.code === "html-no-nested-links")

      expect(nested?.message).toContain("Rendered from `app/views/posts/index.html.erb:12:4`.")
      expect(nested?.relatedInformation).toBeUndefined()
    })
  })
})
