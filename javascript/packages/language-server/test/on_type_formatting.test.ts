import { describe, expect, it, vi } from "vitest"
import { TextDocument } from "vscode-languageserver-textdocument"

const connectionState = vi.hoisted(() => ({
  onTypeFormatting: undefined as
    | ((params: {
        textDocument: { uri: string }
        position: { line: number; character: number }
        ch: string
      }) => unknown)
    | undefined,
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
  it("advertises > as the trigger character", () => {
    expect(ON_TYPE_FORMATTING_OPTIONS).toEqual({
      firstTriggerCharacter: ">",
    })
  })

  it("routes requests through the provider stored in Session", () => {
    const source = "<% if user.admin? %>"
    const document = TextDocument.create(
      "file:///test.html.erb",
      "erb",
      1,
      source,
    )
    const getTextEdits = vi.fn().mockReturnValue([{ newText: "expected" }])
    const server = new Server()

    Object.assign(server, {
      session: {
        documents: { get: vi.fn().mockReturnValue(document) },
        onTypeFormattingProvider: { getTextEdits },
      },
    })

    const params = {
      textDocument: { uri: document.uri },
      position: { line: 0, character: source.length },
      ch: ">",
    }

    expect(connectionState.onTypeFormatting?.(params)).toEqual([
      { newText: "expected" },
    ])
    expect(getTextEdits).toHaveBeenCalledWith(
      document,
      params.position,
      params.ch,
    )
  })
})
