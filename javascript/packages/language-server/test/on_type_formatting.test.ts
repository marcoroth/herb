import { describe, expect, it, vi } from "vitest"
import { TextDocument } from "vscode-languageserver-textdocument"

import {
  ON_TYPE_FORMATTING_OPTIONS,
  handleOnTypeFormatting,
} from "../src/on_type_formatting"

import type { Documents } from "../src/documents"

describe("on-type formatting", () => {
  it("advertises > as the trigger character", () => {
    expect(ON_TYPE_FORMATTING_OPTIONS).toEqual({
      firstTriggerCharacter: ">",
    })
  })

  it("routes an on-type formatting request to the language service", () => {
    const source = "<% if user.admin? %>"
    const document = TextDocument.create(
      "file:///test.html.erb",
      "erb",
      1,
      source,
    )
    const documents = {
      get: vi.fn().mockReturnValue(document),
    } as unknown as Documents

    const edits = handleOnTypeFormatting(documents, {
      textDocument: { uri: document.uri },
      position: { line: 0, character: source.length },
      ch: ">",
      options: { tabSize: 2, insertSpaces: true },
    })

    expect(documents.get).toHaveBeenCalledWith(document.uri)
    expect(edits).toEqual([
      {
        range: {
          start: { line: 0, character: source.length },
          end: { line: 0, character: source.length },
        },
        newText: "\n<% end %>",
      },
    ])
  })

  it("returns no edits when the document is not open", () => {
    const documents = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Documents

    expect(
      handleOnTypeFormatting(documents, {
        textDocument: { uri: "file:///missing.html.erb" },
        position: { line: 0, character: 0 },
        ch: ">",
        options: { tabSize: 2, insertSpaces: true },
      }),
    ).toEqual([])
  })
})
