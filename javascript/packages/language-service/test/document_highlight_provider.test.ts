import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Position, DocumentHighlightKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { DocumentHighlightProvider } from "../src/document_highlight_provider"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("DocumentHighlightProvider", () => {
  let parserService: ParserService
  let service: DocumentHighlightProvider

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService(Herb)
    service = new DocumentHighlightProvider(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getHighlights(content: string, line: number, character: number) {
    const document = createDocument(content)
    return service.getDocumentHighlights(document, Position.create(line, character))
  }

  describe("strict locals", () => {
    const partial = dedent`
      <%# locals: (title:, count: 0) %>

      <h1><%= title %></h1>
      <p>Count is <%= count %></p>
      <% if title.present? %>
        <span><%= title %></span>
      <% end %>
    `

    function texts(highlights: ReturnType<typeof getHighlights>, content: string) {
      const lines = content.split("\n")

      return highlights.map(highlight => lines[highlight.range.start.line].slice(highlight.range.start.character, highlight.range.end.character))
    }

    it("highlights every usage when the cursor is on the declaration", () => {
      const highlights = getHighlights(partial, 0, 15)

      expect(texts(highlights, partial)).toEqual(["title", "title", "title", "title"])
      expect(highlights[0].kind).toBe(DocumentHighlightKind.Write)
      expect(highlights.slice(1).map(highlight => highlight.kind)).toEqual([
        DocumentHighlightKind.Read,
        DocumentHighlightKind.Read,
        DocumentHighlightKind.Read,
      ])
    })

    it("highlights the declaration when the cursor is on a usage", () => {
      const highlights = getHighlights(partial, 2, 9)

      expect(highlights[0].kind).toBe(DocumentHighlightKind.Write)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 13 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 18 })
    })

    it("leaves the colon out of the declaration", () => {
      const highlights = getHighlights(partial, 0, 15)

      expect(texts(highlights, partial)[0]).toBe("title")
    })

    it("finds a usage inside a control flow tag", () => {
      const highlights = getHighlights(partial, 4, 7)

      expect(highlights.map(highlight => highlight.range.start.line)).toEqual([0, 2, 4, 5])
    })

    it("keeps each local separate", () => {
      const highlights = getHighlights(partial, 3, 17)

      expect(texts(highlights, partial)).toEqual(["count", "count"])
    })

    it("highlights a local that is declared but never used", () => {
      const content = `<%# locals: (unused:) %>\n<p>nothing</p>`
      const highlights = getHighlights(content, 0, 15)

      expect(highlights).toHaveLength(1)
      expect(highlights[0].kind).toBe(DocumentHighlightKind.Write)
    })

    it("does not claim a name that is not a declared local", () => {
      const content = dedent`
        <%# locals: (title:) %>

        <p><%= subtitle %></p>
      `
      const highlights = getHighlights(content, 2, 10)

      expect(highlights.every(highlight => highlight.kind !== DocumentHighlightKind.Write)).toBe(true)
    })

    it("still highlights tag pairs elsewhere in a partial with strict locals", () => {
      const highlights = getHighlights(partial, 2, 1)

      expect(highlights.every(highlight => highlight.kind === DocumentHighlightKind.Text)).toBe(true)
      expect(texts(highlights, partial)).toEqual(["<h1", ">", "</h1>"])
    })

    it("follows a local passed with Ruby's shorthand hash syntax", () => {
      const content = dedent`
        <%# locals: (user:, favorite_user:) %>

        <%= render "profiles/header_content", user:, favorite_user: %>
      `

      const fromDeclaration = getHighlights(content, 0, 15)

      expect(texts(fromDeclaration, content)).toEqual(["user", "user"])
      expect(fromDeclaration[0].kind).toBe(DocumentHighlightKind.Write)
      expect(fromDeclaration[1].kind).toBe(DocumentHighlightKind.Read)
      expect(fromDeclaration[1].range.start).toEqual({ line: 2, character: 38 })
      expect(fromDeclaration[1].range.end).toEqual({ line: 2, character: 42 })

      const fromUsage = getHighlights(content, 2, 39)

      expect(texts(fromUsage, content)).toEqual(["user", "user"])

      const other = getHighlights(content, 2, 46)

      expect(texts(other, content)).toEqual(["favorite_user", "favorite_user"])
    })

    it("keeps a block parameter that shadows a strict local out of its group", () => {
      const content = dedent`
        <%# locals: (user:) %>

        <% users.each do |user| %>
          <%= user %>
        <% end %>

        <%= render "profiles/header_content", user: %>
      `

      const strictLocal = getHighlights(content, 0, 15)

      expect(strictLocal.map(highlight => highlight.range.start.line)).toEqual([0, 6])
      expect(strictLocal[0].kind).toBe(DocumentHighlightKind.Write)

      const shadowed = getHighlights(content, 3, 8)

      expect(shadowed.map(highlight => highlight.range.start.line)).toEqual([2, 3])
      expect(shadowed[0].kind).toBe(DocumentHighlightKind.Write)
      expect(shadowed[1].kind).toBe(DocumentHighlightKind.Read)
    })

    it("ignores a template without a strict locals declaration", () => {
      const content = "<p><%= title %></p>"
      const highlights = getHighlights(content, 0, 9)

      expect(highlights.every(highlight => highlight.kind !== DocumentHighlightKind.Write)).toBe(true)
    })
  })

  describe("block locals", () => {
    it("highlights a block parameter and the places it is read", () => {
      const content = dedent`
        <% posts.each do |post| %>
          <%= post.title %>
        <% end %>
      `

      const fromBinding = getHighlights(content, 0, 19)

      expect(fromBinding).toHaveLength(2)
      expect(fromBinding[0].kind).toBe(DocumentHighlightKind.Write)
      expect(fromBinding[0].range.start).toEqual({ line: 0, character: 18 })
      expect(fromBinding[0].range.end).toEqual({ line: 0, character: 22 })
      expect(fromBinding[1].kind).toBe(DocumentHighlightKind.Read)
      expect(fromBinding[1].range.start).toEqual({ line: 1, character: 6 })

      const fromRead = getHighlights(content, 1, 8)

      expect(fromRead.map(highlight => highlight.range.start.line)).toEqual([0, 1])
    })

    it("keeps two blocks taking the same parameter name apart", () => {
      const content = dedent`
        <% posts.each do |post| %>
          <%= post.title %>
        <% end %>
        <% drafts.each do |post| %>
          <%= post.body %>
        <% end %>
      `

      expect(getHighlights(content, 1, 8).map(highlight => highlight.range.start.line)).toEqual([0, 1])
      expect(getHighlights(content, 4, 8).map(highlight => highlight.range.start.line)).toEqual([3, 4])
    })
  })

  describe("HTML tag pairs", () => {
    it("highlights matching open and close tags when cursor is on open tag", () => {
      const content = "<div>hello</div>"
      const highlights = getHighlights(content, 0, 1)

      expect(highlights).toHaveLength(3)
      expect(highlights[0].kind).toBe(DocumentHighlightKind.Text)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 0 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 4 })
      expect(highlights[1].range.start).toEqual({ line: 0, character: 4 })
      expect(highlights[1].range.end).toEqual({ line: 0, character: 5 })
      expect(highlights[2].range.start).toEqual({ line: 0, character: 10 })
      expect(highlights[2].range.end).toEqual({ line: 0, character: 16 })
    })

    it("highlights matching tags when cursor is on close tag", () => {
      const content = "<div>hello</div>"
      const highlights = getHighlights(content, 0, 11)

      expect(highlights).toHaveLength(3)
    })

    it("highlights when cursor is on angle bracket", () => {
      const content = "<div>hello</div>"
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(3)
    })

    it("highlights open tag parts for void elements", () => {
      const content = "<br>"
      const highlights = getHighlights(content, 0, 1)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 0 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 3 })
      expect(highlights[1].range.start).toEqual({ line: 0, character: 3 })
      expect(highlights[1].range.end).toEqual({ line: 0, character: 4 })
    })

    it("highlights when cursor is on > of open tag with attributes", () => {
      const content = '<div class="hello">\n  12312\n</div>'
      const highlights = getHighlights(content, 0, 18)

      expect(highlights).toHaveLength(3)
    })

    it("returns empty when cursor is on content between tags", () => {
      const content = "<div>hello</div>"
      const highlights = getHighlights(content, 0, 7)

      expect(highlights).toHaveLength(0)
    })

    it("highlights multiline tag pairs", () => {
      const content = dedent`
        <div>
          <span>text</span>
        </div>
      `
      const highlights = getHighlights(content, 0, 1)

      expect(highlights).toHaveLength(3)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 0 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 4 })
      expect(highlights[1].range.start).toEqual({ line: 0, character: 4 })
      expect(highlights[1].range.end).toEqual({ line: 0, character: 5 })
      expect(highlights[2].range.start).toEqual({ line: 2, character: 0 })
      expect(highlights[2].range.end).toEqual({ line: 2, character: 6 })
    })
  })

  describe("HTML attributes", () => {
    it("highlights attribute name, equals, and value when cursor is on attribute name", () => {
      const content = '<div class="foo">hello</div>'
      const highlights = getHighlights(content, 0, 5)

      expect(highlights).toHaveLength(3)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 5 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 10 })
      expect(highlights[1].range.start).toEqual({ line: 0, character: 10 })
      expect(highlights[1].range.end).toEqual({ line: 0, character: 11 })
      expect(highlights[2].range.start).toEqual({ line: 0, character: 11 })
      expect(highlights[2].range.end).toEqual({ line: 0, character: 16 })
    })

    it("highlights when cursor is on equals sign", () => {
      const content = '<div class="foo">hello</div>'
      const highlights = getHighlights(content, 0, 10)

      expect(highlights).toHaveLength(3)
    })

    it("highlights when cursor is on value", () => {
      const content = '<div class="foo">hello</div>'
      const highlights = getHighlights(content, 0, 12)

      expect(highlights).toHaveLength(3)
    })

    it("highlights when cursor is on closing quote", () => {
      const content = '<div class="foo">hello</div>'
      const highlights = getHighlights(content, 0, 15)

      expect(highlights).toHaveLength(3)
    })

    it("returns empty for boolean attributes without value", () => {
      const content = "<input disabled>"
      const highlights = getHighlights(content, 0, 7)

      expect(highlights).toHaveLength(0)
    })
  })

  describe("ERB if/end", () => {
    it("highlights if and end when cursor is on if", () => {
      const content = dedent`
        <% if condition %>
          content
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
    })

    it("highlights if and end when cursor is on end", () => {
      const content = dedent`
        <% if condition %>
          content
        <% end %>
      `
      const highlights = getHighlights(content, 2, 0)

      expect(highlights).toHaveLength(2)
    })
  })

  describe("ERB if/elsif/else/end", () => {
    it("highlights all parts of if/elsif/else/end chain", () => {
      const content = dedent`
        <% if a %>
          a
        <% elsif b %>
          b
        <% else %>
          c
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(4)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
      expect(highlights[2].range.start.line).toBe(4)
      expect(highlights[3].range.start.line).toBe(6)
    })

    it("highlights all parts when cursor is on elsif", () => {
      const content = dedent`
        <% if a %>
          a
        <% elsif b %>
          b
        <% else %>
          c
        <% end %>
      `
      const highlights = getHighlights(content, 2, 0)

      expect(highlights).toHaveLength(4)
    })

    it("highlights all parts when cursor is on else", () => {
      const content = dedent`
        <% if a %>
          a
        <% elsif b %>
          b
        <% else %>
          c
        <% end %>
      `
      const highlights = getHighlights(content, 4, 0)

      expect(highlights).toHaveLength(4)
    })

    it("highlights all parts when cursor is on end", () => {
      const content = dedent`
        <% if a %>
          a
        <% elsif b %>
          b
        <% else %>
          c
        <% end %>
      `
      const highlights = getHighlights(content, 6, 0)

      expect(highlights).toHaveLength(4)
    })
  })

  describe("ERB unless/else/end", () => {
    it("highlights unless/else/end chain", () => {
      const content = dedent`
        <% unless condition %>
          a
        <% else %>
          b
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(3)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
      expect(highlights[2].range.start.line).toBe(4)
    })

    it("highlights unless/end without else", () => {
      const content = dedent`
        <% unless condition %>
          a
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
    })
  })

  describe("ERB case/when/else/end", () => {
    it("highlights all parts of case/when/when/else/end", () => {
      const content = dedent`
        <% case value %>
        <% when "a" %>
          a
        <% when "b" %>
          b
        <% else %>
          c
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(5)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(1)
      expect(highlights[2].range.start.line).toBe(3)
      expect(highlights[3].range.start.line).toBe(5)
      expect(highlights[4].range.start.line).toBe(7)
    })

    it("highlights when cursor is on when", () => {
      const content = dedent`
        <% case value %>
        <% when "a" %>
          a
        <% when "b" %>
          b
        <% end %>
      `
      const highlights = getHighlights(content, 1, 0)

      expect(highlights).toHaveLength(4)
    })
  })

  describe("ERB case/in (pattern matching)", () => {
    it("highlights all parts of case/in/else/end", () => {
      const content = dedent`
        <% case value %>
        <% in String %>
          a
        <% in Integer %>
          b
        <% else %>
          c
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(5)
    })
  })

  describe("ERB begin/rescue/ensure/end", () => {
    it("highlights all parts of begin/rescue/ensure/end", () => {
      const content = dedent`
        <% begin %>
          risky
        <% rescue StandardError %>
          handle
        <% ensure %>
          cleanup
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(4)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
      expect(highlights[2].range.start.line).toBe(4)
      expect(highlights[3].range.start.line).toBe(6)
    })

    it("highlights when cursor is on rescue", () => {
      const content = dedent`
        <% begin %>
          risky
        <% rescue %>
          handle
        <% end %>
      `
      const highlights = getHighlights(content, 2, 0)

      expect(highlights).toHaveLength(3)
    })

    it("highlights multiple rescue clauses", () => {
      const content = dedent`
        <% begin %>
          risky
        <% rescue TypeError %>
          handle type
        <% rescue StandardError %>
          handle standard
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(4)
    })
  })

  describe("ERB block/end", () => {
    it("highlights block and end", () => {
      const content = dedent`
        <% items.each do %>
          item
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
    })
  })

  describe("ERB for/end", () => {
    it("highlights for and end", () => {
      const content = dedent`
        <% for item in items %>
          item
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
    })
  })

  describe("ERB while/end", () => {
    it("highlights while and end", () => {
      const content = dedent`
        <% while condition %>
          loop
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
    })
  })

  describe("ERB until/end", () => {
    it("highlights until and end", () => {
      const content = dedent`
        <% until condition %>
          loop
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(2)
    })
  })

  describe("ERB content node", () => {
    it("highlights tag_opening and tag_closing for ERB content", () => {
      const content = "<%= hello %>"
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 0 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 3 })
      expect(highlights[1].range.start).toEqual({ line: 0, character: 10 })
      expect(highlights[1].range.end).toEqual({ line: 0, character: 12 })
    })

    it("highlights when cursor is on tag_closing", () => {
      const content = "<%= hello %>"
      const highlights = getHighlights(content, 0, 11)

      expect(highlights).toHaveLength(2)
    })

    it("returns empty when cursor is on content", () => {
      const content = "<%= hello %>"
      const highlights = getHighlights(content, 0, 5)

      expect(highlights).toHaveLength(0)
    })
  })

  describe("HTML comments", () => {
    it("highlights <!-- and --> when cursor is on <!--", () => {
      const content = "<!-- comment -->"
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start).toEqual({ line: 0, character: 0 })
      expect(highlights[0].range.end).toEqual({ line: 0, character: 4 })
      expect(highlights[1].range.start).toEqual({ line: 0, character: 13 })
      expect(highlights[1].range.end).toEqual({ line: 0, character: 16 })
    })

    it("highlights when cursor is on -->", () => {
      const content = "<!-- comment -->"
      const highlights = getHighlights(content, 0, 14)

      expect(highlights).toHaveLength(2)
    })

    it("returns empty when cursor is on comment content", () => {
      const content = "<!-- comment -->"
      const highlights = getHighlights(content, 0, 6)

      expect(highlights).toHaveLength(0)
    })
  })

  describe("nested structures", () => {
    it("inner if highlights only inner chain, not outer", () => {
      const content = dedent`
        <% if outer %>
          <% if inner %>
            content
          <% end %>
        <% end %>
      `
      const highlights = getHighlights(content, 1, 2)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(1)
      expect(highlights[1].range.start.line).toBe(3)
    })

    it("outer if highlights only outer chain", () => {
      const content = dedent`
        <% if outer %>
          <% if inner %>
            content
          <% end %>
        <% end %>
      `
      const highlights = getHighlights(content, 0, 0)

      expect(highlights).toHaveLength(2)
      expect(highlights[0].range.start.line).toBe(0)
      expect(highlights[1].range.start.line).toBe(4)
    })
  })
})
