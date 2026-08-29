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
  const original = await importOriginal<typeof import("vscode-languageserver/node")>()

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

import { OnTypeFormattingProvider } from "@herb-tools/language-service"

import { ON_TYPE_FORMATTING_OPTIONS } from "../src/on_type_formatting"
import { Server } from "../src/server"

const SOURCE = "  <% if user.admin? %>"

function serverWith(supportsSnippetEdits: boolean, document: TextDocument) {
  const server = new Server()

  Object.assign(server, {
    session: {
      capabilities: { supportsSnippetEdits },
      documents: { get: vi.fn().mockReturnValue(document) },
      onTypeFormattingProvider: new OnTypeFormattingProvider(),
    },
  })

  return server
}

function request(document: TextDocument) {
  return {
    textDocument: { uri: document.uri },
    position: { line: 0, character: SOURCE.length },
    ch: ">",
    options: { tabSize: 2, insertSpaces: true },
  }
}

describe("on-type formatting", () => {
  const document = TextDocument.create("file:///test.html.erb", "erb", 7, SOURCE)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("advertises > as the trigger character", () => {
    expect(ON_TYPE_FORMATTING_OPTIONS).toEqual({
      firstTriggerCharacter: ">",
    })
  })

  it("returns plain text edits when the client cannot apply snippet edits", async () => {
    serverWith(false, document)

    expect(await connectionState.onTypeFormatting?.(request(document))).toEqual([
      {
        range: {
          start: { line: 0, character: SOURCE.length },
          end: { line: 0, character: SOURCE.length },
        },
        newText: "\n    \n  <% end %>",
      },
    ])

    expect(connectionState.applyEdit).not.toHaveBeenCalled()
  })

  it("applies a snippet edit when the client supports snippet edits", async () => {
    serverWith(true, document)

    expect(await connectionState.onTypeFormatting?.(request(document))).toEqual([])

    expect(connectionState.applyEdit).toHaveBeenCalledWith({
      label: "Close ERB block",
      edit: {
        documentChanges: [
          {
            textDocument: { uri: document.uri, version: 7 },
            edits: [
              {
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: SOURCE.length },
                },
                snippet: {
                  kind: "snippet",
                  value: "  <% if user.admin? %>\n    $0\n  <% end %>",
                },
              },
            ],
          },
        ],
      },
    })
  })

  it("does not reach for the client when there is nothing to close", async () => {
    const output = TextDocument.create("file:///output.html.erb", "erb", 1, "<%= user.name %>")

    serverWith(true, output)

    expect(
      await connectionState.onTypeFormatting?.({
        textDocument: { uri: output.uri },
        position: { line: 0, character: 16 },
        ch: ">",
        options: { tabSize: 2, insertSpaces: true },
      }),
    ).toEqual([])

    expect(connectionState.applyEdit).not.toHaveBeenCalled()
  })

  it("reports a failing apply without rejecting the request", async () => {
    connectionState.applyEdit.mockRejectedValueOnce(new Error("no editor"))

    serverWith(true, document)

    expect(await connectionState.onTypeFormatting?.(request(document))).toEqual([])
    expect(connectionState.error).toHaveBeenCalledWith("Failed to close ERB block: Error: no editor")
  })
})
