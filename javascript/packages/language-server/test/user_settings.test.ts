import { describe, test, expect, vi } from "vitest"

import { UserSettings } from "../src/user_settings"
import { Capabilities } from "../src/capabilities"

import type { Connection, InitializeParams } from "vscode-languageserver/node"

describe("UserSettings", () => {
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

  const withConfiguration: InitializeParams = {
    ...mockParams,
    capabilities: { workspace: { configuration: true } }
  }

  function settingsFor(params: InitializeParams): UserSettings {
    return new UserSettings(mockConnection, new Capabilities(params))
  }

  describe("defaults", () => {
    test("enable the linter and fixing on save", () => {
      const settings = settingsFor(mockParams)

      expect(settings.defaults.linter?.enabled).toBe(true)
      expect(settings.defaults.linter?.fixOnSave).toBe(true)
    })

    test("leave the formatter off but fully specified", () => {
      const settings = settingsFor(mockParams)

      expect(settings.defaults.formatter?.enabled).toBe(false)
      expect(settings.defaults.formatter?.indentWidth).toBeDefined()
      expect(settings.defaults.formatter?.indentStyle).toBeDefined()
      expect(settings.defaults.formatter?.maxLineLength).toBeDefined()
    })
  })

  describe("getDocumentSettings", () => {
    test("falls back to the defaults when the client can't be asked", async () => {
      const settings = settingsFor(mockParams)

      const result = await settings.getDocumentSettings("file:///test.html.erb")

      expect(result).toEqual(settings.defaults)
      expect(result.linter?.enabled).toBe(true)
    })

    test("asks the client, scoped to the document", async () => {
      mockConnection.workspace.getConfiguration = vi.fn().mockResolvedValue({
        linter: { enabled: false },
        formatter: { enabled: true }
      })

      const result = await settingsFor(withConfiguration).getDocumentSettings("file:///test.erb")

      expect(result).toEqual({
        trace: undefined,
        linter: { enabled: false, fixOnSave: true },
        formatter: {
          enabled: true,
          indentWidth: 2,
          indentStyle: "space",
          maxLineLength: 80
        }
      })

      expect(mockConnection.workspace.getConfiguration).toHaveBeenCalledWith({
        scopeUri: "file:///test.erb",
        section: "languageServerHerb"
      })
    })

    test("handles a client that answers with nothing", async () => {
      mockConnection.workspace.getConfiguration = vi.fn().mockResolvedValue(null)

      const result = await settingsFor(withConfiguration).getDocumentSettings("file:///test.erb")

      expect(result).toEqual({
        trace: undefined,
        linter: { enabled: true, fixOnSave: true },
        formatter: {
          enabled: false,
          indentWidth: 2,
          indentStyle: "space",
          maxLineLength: 80
        }
      })
    })

    test("keeps fixOnSave when the user turns it off", async () => {
      mockConnection.workspace.getConfiguration = vi.fn().mockResolvedValue({
        linter: { enabled: true, fixOnSave: false },
        formatter: { enabled: false }
      })

      const result = await settingsFor(withConfiguration).getDocumentSettings("file:///test.erb")

      expect(result.linter?.fixOnSave).toBe(false)
    })

    test("asks the client once per document until the answer is forgotten", async () => {
      const getConfiguration = vi.fn().mockResolvedValue({ linter: { enabled: true } })
      mockConnection.workspace.getConfiguration = getConfiguration

      const settings = settingsFor(withConfiguration)

      await settings.getDocumentSettings("file:///test.erb")
      await settings.getDocumentSettings("file:///test.erb")

      expect(getConfiguration).toHaveBeenCalledTimes(1)

      settings.forget("file:///test.erb")
      await settings.getDocumentSettings("file:///test.erb")

      expect(getConfiguration).toHaveBeenCalledTimes(2)
    })

    test("forgetAll drops every cached answer", async () => {
      const getConfiguration = vi.fn().mockResolvedValue({ linter: { enabled: true } })
      mockConnection.workspace.getConfiguration = getConfiguration

      const settings = settingsFor(withConfiguration)

      await settings.getDocumentSettings("file:///a.erb")
      await settings.getDocumentSettings("file:///b.erb")

      settings.forgetAll()

      await settings.getDocumentSettings("file:///a.erb")

      expect(getConfiguration).toHaveBeenCalledTimes(3)
    })
  })
})
