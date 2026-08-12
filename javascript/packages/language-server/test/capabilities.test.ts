import { describe, test, expect } from "vitest"

import { Capabilities } from "../src/capabilities"

import type { InitializeParams } from "vscode-languageserver/node"

describe("Capabilities", () => {
  const mockParams: InitializeParams = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  }

  describe("client feature flags", () => {
    test("are all off for a client that advertises nothing", () => {
      const capabilities = new Capabilities(mockParams)

      expect(capabilities.hasConfiguration).toBe(false)
      expect(capabilities.hasWorkspaceFolders).toBe(false)
      expect(capabilities.hasShowDocument).toBe(false)
      expect(capabilities.hasDiagnosticRelatedInformation).toBe(false)
    })

    test("follow what the client advertised", () => {
      const capabilities = new Capabilities({
        ...mockParams,
        capabilities: {
          workspace: { configuration: true, workspaceFolders: true },
          window: { showDocument: { support: true } },
          textDocument: { publishDiagnostics: { relatedInformation: true } }
        }
      })

      expect(capabilities.hasConfiguration).toBe(true)
      expect(capabilities.hasWorkspaceFolders).toBe(true)
      expect(capabilities.hasShowDocument).toBe(true)
      expect(capabilities.hasDiagnosticRelatedInformation).toBe(true)
    })
  })

  describe("supportsDefinitionLinks", () => {
    test("is false when the client doesn't support link responses", () => {
      expect(new Capabilities(mockParams).supportsDefinitionLinks).toBe(false)
    })

    test("is true when the client supports link responses", () => {
      const capabilities = new Capabilities({
        ...mockParams,
        capabilities: { textDocument: { definition: { linkSupport: true } } }
      })

      expect(capabilities.supportsDefinitionLinks).toBe(true)
    })
  })

  describe("supportsResourceCreation", () => {
    test("is false when the client doesn't advertise resource operations", () => {
      expect(new Capabilities(mockParams).supportsResourceCreation).toBe(false)
    })

    test("is true when the client can create files", () => {
      const capabilities = new Capabilities({
        ...mockParams,
        capabilities: {
          workspace: {
            workspaceEdit: {
              documentChanges: true,
              resourceOperations: ["create", "rename", "delete"]
            }
          }
        }
      })

      expect(capabilities.supportsResourceCreation).toBe(true)
    })
  })

  describe("supportsExtractToPartialCommand", () => {
    test("is false without initialization options", () => {
      expect(new Capabilities(mockParams).supportsExtractToPartialCommand).toBe(false)
    })

    test("is true when the client registers the command", () => {
      const capabilities = new Capabilities({
        ...mockParams,
        initializationOptions: {
          experimental: { extractToPartialCommand: true }
        }
      })

      expect(capabilities.supportsExtractToPartialCommand).toBe(true)
    })
  })
})
