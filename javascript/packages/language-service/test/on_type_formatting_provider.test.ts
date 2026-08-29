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
        newText: "\n  \n<% end %>",
      },
    ])
  })

  it.each([
    "<% if user.admin? %>",
    "<% unless items.empty? %>",
    "<% while pending? %>",
    "<% for item in items %>",
    "<% case status %>",
    "<% begin %>",
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
        newText: "\n      \n    <% end %>",
      },
    ])
  })

  it("uses the editor indentation options for the block body", () => {
    const source = "\t<% if user.admin? %>"
    const document = createDocument(source)

    expect(
      provider.getTextEdits(document, Position.create(0, source.length), ">", {
        tabSize: 4,
        insertSpaces: false,
      }),
    ).toEqual([
      {
        range: {
          start: { line: 0, character: source.length },
          end: { line: 0, character: source.length },
        },
        newText: "\n\t\t\n\t<% end %>",
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
    ).toBe("\n    \n  <% end %>")
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

  it("does not consume an enclosing block's end tag", () => {
    const openingTag = "  <% if item.ok? %>"
    const document = createDocument(
      [
        "<% items.each do |item| %>",
        openingTag,
        "  <% end %>",
        "<% end %>",
      ].join("\n"),
    )

    expect(
      provider.getTextEdits(
        document,
        Position.create(1, openingTag.length),
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

  it("inserts an end tag for a block opened inside an existing block", () => {
    const openingTag = "  <% if item.ok? %>"
    const document = createDocument(
      ["<% items.each do |item| %>", openingTag, "<% end %>"].join("\n"),
    )

    expect(
      provider.getTextEdits(
        document,
        Position.create(1, openingTag.length),
        ">",
      ),
    ).toEqual([
      {
        range: {
          start: { line: 1, character: openingTag.length },
          end: { line: 1, character: openingTag.length },
        },
        newText: "\n    \n  <% end %>",
      },
    ])
  })

  it("preserves indentation when inserting inside nested ERB and HTML", () => {
    const openingTag = "      <% if y %>"
    const document = createDocument(
      [
        "<section>",
        "  <% a.each do |x| %>",
        "    <div>",
        "      <% b.each do |y| %>",
        openingTag,
        "      <% end %>",
        "    </div>",
        "  <% end %>",
        "</section>",
      ].join("\n"),
    )

    expect(
      provider.getTextEdits(
        document,
        Position.create(4, openingTag.length),
        ">",
      ),
    ).toEqual([
      {
        range: {
          start: { line: 4, character: openingTag.length },
          end: { line: 4, character: openingTag.length },
        },
        newText: "\n        \n      <% end %>",
      },
    ])
  })

  it("does not insert for a non-block tag when another block is missing an end", () => {
    const assignment = "  <% user = current_user %>"
    const document = createDocument(
      ["<% if signed_in? %>", assignment].join("\n"),
    )

    expect(
      provider.getTextEdits(
        document,
        Position.create(1, assignment.length),
        ">",
      ),
    ).toEqual([])
  })

  describe("getSnippetTextEdits", () => {
    it("restates the opener and puts the final tabstop on the block body", () => {
      const source = "  <% @items.each do |item| %>"
      const document = createDocument(source)

      expect(
        provider.getSnippetTextEdits(
          document,
          Position.create(0, source.length),
          ">",
        ),
      ).toEqual([
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: source.length },
          },
          snippet: {
            kind: "snippet",
            value: "  <% @items.each do |item| %>\n    $0\n  <% end %>",
          },
        },
      ])
    })

    it("only spans the opener's own line", () => {
      const openingTag = "    <% if item.ok? %>"
      const document = createDocument(`<div>\n${openingTag}`)

      expect(
        provider.getSnippetTextEdits(
          document,
          Position.create(1, openingTag.length),
          ">",
        ),
      ).toEqual([
        {
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: openingTag.length },
          },
          snippet: {
            kind: "snippet",
            value: "    <% if item.ok? %>\n      $0\n    <% end %>",
          },
        },
      ])
    })

    it("uses the editor indentation options for the block body", () => {
      const source = "\t<% if user.admin? %>"
      const document = createDocument(source)

      expect(
        provider.getSnippetTextEdits(
          document,
          Position.create(0, source.length),
          ">",
          { tabSize: 4, insertSpaces: false },
        )?.[0].snippet.value,
      ).toBe("\t<% if user.admin? %>\n\t\t$0\n\t<% end %>")
    })

    it.each([
      ["<% if $DEBUG %>", "<% if \\$DEBUG %>"],
      ['<% if title == "#{name}" %>', '<% if title == "#{name\\}" %>'],
      ['<% if path == "C:\\\\tmp" %>', '<% if path == "C:\\\\\\\\tmp" %>'],
    ])("escapes snippet syntax in %s", (source, escaped) => {
      const document = createDocument(source)

      expect(
        provider.getSnippetTextEdits(
          document,
          Position.create(0, source.length),
          ">",
        )?.[0].snippet.value,
      ).toBe(`${escaped}\n  $0\n<% end %>`)
    })

    it.each([
      "<%= user.name %>",
      "<%# explain this template %>",
      "<% user = current_user %>",
    ])("returns no snippet edit for %s", (source) => {
      const document = createDocument(source)

      expect(
        provider.getSnippetTextEdits(
          document,
          Position.create(0, source.length),
          ">",
        ),
      ).toEqual([])
    })

    it("does not duplicate an existing matching end tag", () => {
      const firstLine = "<% if user.admin? %>"
      const document = createDocument(
        `${firstLine}\n  <span>Admin</span>\n<% end %>`,
      )

      expect(
        provider.getSnippetTextEdits(
          document,
          Position.create(0, firstLine.length),
          ">",
        ),
      ).toEqual([])
    })
  })
})
