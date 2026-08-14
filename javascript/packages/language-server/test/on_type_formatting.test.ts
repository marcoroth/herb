import { beforeEach, describe, expect, it, vi } from "vitest"
import { TextDocument } from "vscode-languageserver-textdocument"

const connectionState = vi.hoisted(() => ({
  applyEdit: vi.fn(),
  error: vi.fn(),
  onTypeFormatting: undefined as
    | ((params: {
        textDocument: { uri: string }
        position: { line: number; character: number }
        ch: string
        options: { tabSize: number; insertSpaces: boolean }
      }) => unknown)
    | undefined,
  showDocument: vi.fn(),
  warn: vi.fn(),
}))

vi.mock("vscode-languageserver/node", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("vscode-languageserver/node")>()
  const connection = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "onDocumentOnTypeFormatting") {
          return (handler: typeof connectionState.onTypeFormatting) => {
            connectionState.onTypeFormatting = handler
          }
        }

        if (property === "languages") {
          return { inlayHint: { on: vi.fn() } }
        }

        if (property === "console") {
          return { error: connectionState.error, warn: connectionState.warn }
        }

        if (property === "workspace") {
          return { applyEdit: connectionState.applyEdit }
        }

        if (property === "window") {
          return { showDocument: connectionState.showDocument }
        }

        return vi.fn()
      },
    },
  )

  return {
    ...original,
    createConnection: vi.fn(() => connection),
  }
})

import { ON_TYPE_FORMATTING_OPTIONS } from "../src/on_type_formatting"
import { Server } from "../src/server"

describe("on-type formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("advertises > as the trigger character", () => {
    expect(ON_TYPE_FORMATTING_OPTIONS).toEqual({
      firstTriggerCharacter: ">",
    })
  })

  it("routes requests through the provider stored in Session", async () => {
    const source = "<% if user.admin? %>"
    const document = TextDocument.create(
      "file:///test.html.erb",
      "erb",
      1,
      source,
    )
    const getFormatting = vi.fn().mockReturnValue({
      edits: [{ newText: "expected" }],
      cursor: null,
    })
    const server = new Server()

    Object.assign(server, {
      session: {
        capabilities: { hasApplyEdit: false, hasShowDocument: false },
        documents: { get: vi.fn().mockReturnValue(document) },
        onTypeFormattingProvider: { getFormatting },
      },
    })

    const params = {
      textDocument: { uri: document.uri },
      position: { line: 0, character: source.length },
      ch: ">",
      options: { tabSize: 4, insertSpaces: true },
    }

    await expect(connectionState.onTypeFormatting?.(params)).resolves.toEqual([
      { newText: "expected" },
    ])
    expect(getFormatting).toHaveBeenCalledWith(
      document,
      params.position,
      params.ch,
      params.options,
    )
  })

  it("applies the edit before moving the cursor to the block body", async () => {
    const source = "<% if user.admin? %>"
    const document = TextDocument.create(
      "file:///test.html.erb",
      "erb",
      1,
      source,
    )
    const edit = {
      range: {
        start: { line: 0, character: source.length },
        end: { line: 0, character: source.length },
      },
      newText: "\n  \n<% end %>",
    }
    const cursor = { line: 1, character: 2 }
    const server = new Server()

    connectionState.applyEdit.mockResolvedValue({ applied: true })
    connectionState.showDocument.mockResolvedValue({ success: true })

    Object.assign(server, {
      session: {
        capabilities: { hasApplyEdit: true, hasShowDocument: true },
        documents: { get: vi.fn().mockReturnValue(document) },
        onTypeFormattingProvider: {
          getFormatting: vi.fn().mockReturnValue({ edits: [edit], cursor }),
        },
      },
    })

    const result = await connectionState.onTypeFormatting?.({
      textDocument: { uri: document.uri },
      position: { line: 0, character: source.length },
      ch: ">",
      options: { tabSize: 2, insertSpaces: true },
    })

    expect(connectionState.applyEdit).toHaveBeenCalledWith({
      changes: { [document.uri]: [edit] },
    })
    expect(connectionState.showDocument).toHaveBeenCalledWith({
      uri: document.uri,
      takeFocus: true,
      selection: { start: cursor, end: cursor },
    })
    expect(connectionState.applyEdit.mock.invocationCallOrder[0]).toBeLessThan(
      connectionState.showDocument.mock.invocationCallOrder[0],
    )
    expect(result).toEqual([])
  })

  it("returns the edit when the client does not apply it", async () => {
    const source = "<% if user.admin? %>"
    const document = TextDocument.create(
      "file:///test.html.erb",
      "erb",
      1,
      source,
    )
    const edit = { newText: "\n  \n<% end %>" }
    const server = new Server()

    connectionState.applyEdit.mockResolvedValue({ applied: false })

    Object.assign(server, {
      session: {
        capabilities: { hasApplyEdit: true, hasShowDocument: true },
        documents: { get: vi.fn().mockReturnValue(document) },
        onTypeFormattingProvider: {
          getFormatting: vi.fn().mockReturnValue({
            edits: [edit],
            cursor: { line: 1, character: 2 },
          }),
        },
      },
    })

    const result = await connectionState.onTypeFormatting?.({
      textDocument: { uri: document.uri },
      position: { line: 0, character: source.length },
      ch: ">",
      options: { tabSize: 2, insertSpaces: true },
    })

    expect(result).toEqual([edit])
    expect(connectionState.showDocument).not.toHaveBeenCalled()
  })

  it("keeps the applied edit when moving the cursor fails", async () => {
    const source = "<% if user.admin? %>"
    const document = TextDocument.create(
      "file:///test.html.erb",
      "erb",
      1,
      source,
    )
    const server = new Server()

    connectionState.applyEdit.mockResolvedValue({ applied: true })
    connectionState.showDocument.mockRejectedValue(new Error("client failure"))

    Object.assign(server, {
      session: {
        capabilities: { hasApplyEdit: true, hasShowDocument: true },
        documents: { get: vi.fn().mockReturnValue(document) },
        onTypeFormattingProvider: {
          getFormatting: vi.fn().mockReturnValue({
            edits: [{ newText: "\n  \n<% end %>" }],
            cursor: { line: 1, character: 2 },
          }),
        },
      },
    })

    const request = connectionState.onTypeFormatting?.({
      textDocument: { uri: document.uri },
      position: { line: 0, character: source.length },
      ch: ">",
      options: { tabSize: 2, insertSpaces: true },
    })

    await expect(request).resolves.toEqual([])
    expect(connectionState.error).toHaveBeenCalled()
  })
})
