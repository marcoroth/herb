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

    test("includes formatter configuration", () => {
      const settings = new Settings(mockParams, mockConnection)

      expect(settings.defaultSettings.formatter).toBeDefined()
      expect(settings.defaultSettings.formatter?.enabled).toBe(false)
      expect(settings.defaultSettings.formatter?.indentWidth).toBeDefined()
      expect(settings.defaultSettings.formatter?.maxLineLength).toBeDefined()
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

      expect(result).toEqual(customSettings)
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

      expect(result).toBeNull()
    })
  })
})
