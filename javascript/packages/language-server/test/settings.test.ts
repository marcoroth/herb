import { describe, test, expect, vi } from "vitest"
import { Settings } from "../src/settings"
import type { Connection, InitializeParams } from "vscode-languageserver/node"

describe("Settings", () => {
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

  describe("defaultSettings", () => {
    test("includes linter configuration with enabled: true", () => {
      const settings = new Settings(mockParams, mockConnection)

      expect(settings.defaultSettings).toBeDefined()
      expect(settings.defaultSettings.linter).toBeDefined()
      expect(settings.defaultSettings.linter?.enabled).toBe(true)
    })

    test("includes linter.fixOnSave configuration with default: true", () => {
      const settings = new Settings(mockParams, mockConnection)

      expect(settings.defaultSettings.linter).toBeDefined()
      expect(settings.defaultSettings.linter?.fixOnSave).toBe(true)
    })

    test("includes formatter configuration", () => {
      const settings = new Settings(mockParams, mockConnection)

      expect(settings.defaultSettings.formatter).toBeDefined()
      expect(settings.defaultSettings.formatter?.enabled).toBe(false)
      expect(settings.defaultSettings.formatter?.indentWidth).toBeDefined()
      expect(settings.defaultSettings.formatter?.indentStyle).toBeDefined()
      expect(settings.defaultSettings.formatter?.maxLineLength).toBeDefined()
    })
  })

  describe("includes", () => {
    function settingsFor(folders: string[] | null, rootUri: string | null = null): Settings {
      return new Settings({
        ...mockParams,
        rootUri,
        workspaceFolders: folders?.map(uri => ({ uri, name: uri })) ?? null,
      }, mockConnection)
    }

    test("accepts a document inside the only workspace folder", () => {
      expect(settingsFor(["file:///work/foo"]).includes("file:///work/foo/app/views/a.html.erb")).toBe(true)
    })

    test("accepts a document inside any workspace folder", () => {
      const settings = settingsFor(["file:///work/foo", "file:///work/bar"])

      expect(settings.includes("file:///work/bar/app/views/a.html.erb")).toBe(true)
    })

    test("rejects a document saved outside every workspace folder", () => {
      expect(settingsFor(["file:///work/foo"]).includes("file:///work/bar/example.html")).toBe(false)
    })

    test("rejects a sibling folder that merely shares a prefix", () => {
      expect(settingsFor(["file:///work/foo"]).includes("file:///work/foobar/example.html")).toBe(false)
    })

    test("accepts the workspace folder itself", () => {
      expect(settingsFor(["file:///work/foo"]).includes("file:///work/foo")).toBe(true)
    })

    test("falls back to rootUri when no folders are given", () => {
      const settings = settingsFor(null, "file:///work/foo")

      expect(settings.includes("file:///work/foo/a.html.erb")).toBe(true)
      expect(settings.includes("file:///work/bar/a.html.erb")).toBe(false)
    })

    test("accepts everything when the client opened no folder at all", () => {
      expect(settingsFor(null).includes("file:///anywhere/a.html.erb")).toBe(true)
    })

    test("accepts an untitled buffer, which has nowhere to live", () => {
      expect(settingsFor(["file:///work/foo"]).includes("untitled:Untitled-1")).toBe(true)
    })

    test("accepts a document served by a virtual filesystem", () => {
      expect(settingsFor(["file:///work/foo"]).includes("vscode-vfs://github/marcoroth/herb/a.html.erb")).toBe(true)
    })

    test("handles a percent encoded path", () => {
      expect(settingsFor(["file:///work/my%20app"]).includes("file:///work/my%20app/a.html.erb")).toBe(true)
    })
  })

  describe("getDocumentSettings", () => {
    test("returns defaultSettings when hasConfigurationCapability is false", async () => {
      const settings = new Settings(mockParams, mockConnection)
      settings.hasConfigurationCapability = false

      const result = await settings.getDocumentSettings("file:///test.html.erb")

      expect(result).toEqual(settings.defaultSettings)
      expect(result.linter?.enabled).toBe(true)
    })

    test("returns workspace configuration when hasConfigurationCapability is true", async () => {
      const paramsWithConfig: InitializeParams = {
        ...mockParams,
        capabilities: {
          workspace: {
            configuration: true
          }
        }
      }

      const customSettings = {
        linter: { enabled: false },
        formatter: { enabled: true }
      }

      mockConnection.workspace.getConfiguration = vi.fn().mockResolvedValue(customSettings)

      const settings = new Settings(paramsWithConfig, mockConnection)
      const result = await settings.getDocumentSettings("file:///test.erb")

      expect(result).toEqual({
        trace: undefined,
        linter: { enabled: false, fixOnSave: true },
        formatter: {
          enabled: true,
          indentWidth: 2,
          indentStyle: "spaces",
          maxLineLength: 80
        }
      })
      expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledWith({
        scopeUri: "file:///test.erb",
        section: "languageServerHerb"
      })
    })

    test("handles null settings gracefully", async () => {
      const paramsWithConfig: InitializeParams = {
        ...mockParams,
        capabilities: {
          workspace: {
            configuration: true
          }
        }
      }

      mockConnection.workspace.getConfiguration = vi.fn().mockResolvedValue(null)

      const settings = new Settings(paramsWithConfig, mockConnection)
      const result = await settings.getDocumentSettings("file:///test.erb")

      expect(result).toEqual({
        trace: undefined,
        linter: { enabled: true, fixOnSave: true },
        formatter: {
          enabled: false,
          indentWidth: 2,
          indentStyle: "spaces",
          maxLineLength: 80
        }
      })
    })

    test("includes fixOnSave in merged settings", async () => {
      const paramsWithConfig: InitializeParams = {
        ...mockParams,
        capabilities: {
          workspace: {
            configuration: true
          }
        }
      }

      const customSettings = {
        linter: { enabled: true, fixOnSave: false },
        formatter: { enabled: false }
      }

      mockConnection.workspace.getConfiguration = vi.fn().mockResolvedValue(customSettings)

      const settings = new Settings(paramsWithConfig, mockConnection)
      const result = await settings.getDocumentSettings("file:///test.erb")

      expect(result.linter?.fixOnSave).toBe(false)
    })
  })

  describe("supportsResourceCreation", () => {
    test("is false when the client doesn't advertise resource operations", () => {
      const settings = new Settings(mockParams, mockConnection)

      expect(settings.supportsResourceCreation).toBe(false)
    })

    test("is true when the client can create files", () => {
      const params: InitializeParams = {
        ...mockParams,
        capabilities: {
          workspace: {
            workspaceEdit: {
              documentChanges: true,
              resourceOperations: ["create", "rename", "delete"]
            }
          }
        }
      }

      const settings = new Settings(params, mockConnection)

      expect(settings.supportsResourceCreation).toBe(true)
    })
  })

  describe("supportsExtractToPartialCommand", () => {
    test("is false without initialization options", () => {
      const settings = new Settings(mockParams, mockConnection)

      expect(settings.supportsExtractToPartialCommand).toBe(false)
    })

    test("is true when the client registers the command", () => {
      const params: InitializeParams = {
        ...mockParams,
        initializationOptions: {
          experimental: { extractToPartialCommand: true }
        }
      }

      const settings = new Settings(params, mockConnection)

      expect(settings.supportsExtractToPartialCommand).toBe(true)
    })
  })
})
