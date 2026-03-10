import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Position, MarkupKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { HoverService } from "../src/hover_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("HoverService", () => {
  let parserService: ParserService
  let service: HoverService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new HoverService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getHover(content: string, line: number, character: number) {
    const document = createDocument(content)
    return service.getHover(document, Position.create(line, character))
  }

  describe("tag.* helpers", () => {
    it("shows hover for tag.div with block", () => {
      const content = dedent`
        <%= tag.div do %>
          Content
        <% end %>
      `

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()
      expect(hover!.contents).toHaveProperty("kind", MarkupKind.Markdown)

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("```erb")
      expect(value).toContain("<div>")
      expect(value).toContain("HTML equivalent")
    })

    it("shows signature for tag helper", () => {
      const content = "<%= tag.div do %><% end %>"

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("```ruby")
      expect(value).toContain("tag.<tag name>(optional content, options)")
    })

    it("shows documentation link for tag helper", () => {
      const content = "<%= tag.div do %><% end %>"

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("ActionView::Helpers::TagHelper#tag")
      expect(value).toContain("https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag")
    })

    it("shows hover for tag.div with attributes", () => {
      const content = '<%= tag.div class: "container" do %><% end %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("<div")
      expect(value).toContain("container")
    })

    it("shows hover for tag with content argument", () => {
      const content = '<%= tag.p "Hello" %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("<p>")
    })
  })

  describe("content_tag", () => {
    it("shows hover for content_tag", () => {
      const content = '<%= content_tag :div do %><% end %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("<div>")
    })

    it("shows signature for content_tag", () => {
      const content = '<%= content_tag :div do %><% end %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("content_tag(")
    })

    it("shows documentation link for content_tag", () => {
      const content = '<%= content_tag :div do %><% end %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("ActionView::Helpers::TagHelper#content_tag")
      expect(value).toContain("https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-content_tag")
    })
  })

  describe("link_to", () => {
    it("shows hover for link_to", () => {
      const content = '<%= link_to "Home", root_path %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("<a")
    })

    it("shows signature for link_to", () => {
      const content = '<%= link_to "Home", root_path %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("link_to(")
    })

    it("shows documentation link for link_to", () => {
      const content = '<%= link_to "Home", root_path %>'

      const hover = getHover(content, 0, 5)

      expect(hover).not.toBeNull()

      const value = (hover!.contents as { value: string }).value
      expect(value).toContain("ActionView::Helpers::UrlHelper#link_to")
      expect(value).toContain("https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to")
    })
  })

  describe("non-ActionView elements", () => {
    it("returns null for plain HTML elements", () => {
      const content = "<div>hello</div>"

      const hover = getHover(content, 0, 2)

      expect(hover).toBeNull()
    })

    it("returns null for plain text", () => {
      const content = "just some text"

      const hover = getHover(content, 0, 5)

      expect(hover).toBeNull()
    })

    it("returns null for regular ERB expressions", () => {
      const content = "<%= some_method %>"

      const hover = getHover(content, 0, 5)

      expect(hover).toBeNull()
    })
  })
})
