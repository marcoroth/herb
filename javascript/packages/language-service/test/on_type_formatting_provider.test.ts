import { describe, expect, it } from "vitest"
import { Position } from "vscode-languageserver-types"
import { TextDocument } from "vscode-languageserver-textdocument"

import { OnTypeFormattingProvider } from "../src/on_type_formatting_provider.js"

function createDocument(content: string) {
  return TextDocument.create("file:///test.html.erb", "erb", 1, content)
}

describe("OnTypeFormattingProvider", () => {
  const provider = new OnTypeFormattingProvider()

  it("inserts an ERB end tag after a do block opener", () => {
    const source = "<% @items.each do |item| %>"
    const document = createDocument(source)

    expect(
      provider.getTextEdits(document, Position.create(0, source.length), ">"),
    ).toEqual([
      {
        range: {
          start: { line: 0, character: source.length },
          end: { line: 0, character: source.length },
        },
        newText: "\n<% end %>",
      },
    ])
  })

  it.each([
    "<% if user.admin? %>",
    "<% unless items.empty? %>",
    "<% while pending? %>",
    "<% for item in items %>",
  ])("inserts an ERB end tag for %s", (source) => {
    const document = createDocument(source)

    expect(
      provider.getTextEdits(document, Position.create(0, source.length), ">"),
    ).toHaveLength(1)
  })

  it("preserves the opening tag indentation", () => {
    const source = "    <% if user.admin? %>"
    const document = createDocument(source)

    expect(
      provider.getTextEdits(document, Position.create(0, source.length), ">"),
    ).toEqual([
      {
        range: {
          start: { line: 0, character: source.length },
          end: { line: 0, character: source.length },
        },
        newText: "\n    <% end %>",
      },
    ])
  })

  it("preserves indentation inside nested markup", () => {
    const openingTag = "  <% @items.each do |item| %>"
    const document = createDocument(`<div>\n${openingTag}`)

    expect(
      provider.getTextEdits(
        document,
        Position.create(1, openingTag.length),
        ">",
      )?.[0].newText,
    ).toBe("\n  <% end %>")
  })

  it.each([
    "<% user = current_user %>",
    "<%= user.name %>",
    "<%# explain this template %>",
    "<% puts user.name if user %>",
    "<% items.each %>",
  ])("does not insert an end tag for %s", (source) => {
    const document = createDocument(source)

    expect(
      provider.getTextEdits(document, Position.create(0, source.length), ">"),
    ).toEqual([])
  })

  it("ignores trigger characters other than >", () => {
    const source = "<% if user.admin? %>"
    const document = createDocument(source)

    expect(
      provider.getTextEdits(document, Position.create(0, source.length), "%"),
    ).toEqual([])
  })

  it("does not duplicate an existing matching end tag", () => {
    const firstLine = "<% if user.admin? %>"
    const document = createDocument(
      `${firstLine}\n  <span>Admin</span>\n<% end %>`,
    )

    expect(
      provider.getTextEdits(
        document,
        Position.create(0, firstLine.length),
        ">",
      ),
    ).toEqual([])
  })

  it("finds the matching end tag after a nested block", () => {
    const firstLine = "<% if user.admin? %>"
    const document = createDocument(
      [
        firstLine,
        "  <% items.each do |item| %>",
        "    <%= item %>",
        "  <% end %>",
        "<% end %>",
      ].join("\n"),
    )

    expect(
      provider.getTextEdits(
        document,
        Position.create(0, firstLine.length),
        ">",
      ),
    ).toEqual([])
  })
})
