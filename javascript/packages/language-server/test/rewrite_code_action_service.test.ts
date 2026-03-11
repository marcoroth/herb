import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Range, CodeActionKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { RewriteCodeActionService } from "../src/rewrite_code_action_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("RewriteCodeActionService", () => {
  let parserService: ParserService
  let service: RewriteCodeActionService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new RewriteCodeActionService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getCodeActions(content: string, startLine: number, startChar: number, endLine: number, endChar: number) {
    const document = createDocument(content)
    const range = Range.create(startLine, startChar, endLine, endChar)
    return service.getCodeActions(document, range)
  }

  describe("ActionView to HTML", () => {
    it("offers convert to HTML for tag.div", () => {
      const content = dedent`
        <%= tag.div do %>
          Content
        <% end %>
      `

      const actions = getCodeActions(content, 0, 0, 2, 8)

      const convertAction = actions.find(a => a.title.includes("Convert to"))
      expect(convertAction).toBeDefined()
      expect(convertAction!.title).toBe("Herb: Convert to `<div>`")
      expect(convertAction!.kind).toBe(CodeActionKind.RefactorRewrite)
    })

    it("includes a text edit that replaces with HTML", () => {
      const content = dedent`
        <%= tag.div do %>
          Content
        <% end %>
      `

      const actions = getCodeActions(content, 0, 0, 2, 8)

      const convertAction = actions.find(a => a.title.includes("<div>"))
      expect(convertAction).toBeDefined()
      expect(convertAction!.edit).toBeDefined()

      const changes = convertAction!.edit!.changes!["file:///test.html.erb"]
      expect(changes).toHaveLength(1)
      expect(changes[0].newText).toContain("<div>")
      expect(changes[0].newText).toContain("</div>")
    })

    it("offers convert for tag.span", () => {
      const content = '<%= tag.span "text" %>'

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const convertAction = actions.find(a => a.title.includes("<span>"))
      expect(convertAction).toBeDefined()
      expect(convertAction!.title).toBe("Herb: Convert to `<span>`")
    })

    it("offers convert for tag with attributes", () => {
      const content = '<%= tag.div class: "container" do %><% end %>'

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const convertAction = actions.find(a => a.title.includes("<div>"))
      expect(convertAction).toBeDefined()

      const changes = convertAction!.edit!.changes!["file:///test.html.erb"]
      expect(changes[0].newText).toContain("container")
    })
  })

  describe("HTML to ActionView", () => {
    it("offers convert to tag helper for div", () => {
      const content = "<div>hello</div>"

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const convertAction = actions.find(a => a.title.includes("tag.div"))
      expect(convertAction).toBeDefined()
      expect(convertAction!.title).toBe("Herb: Convert to `tag.div`")
      expect(convertAction!.kind).toBe(CodeActionKind.RefactorRewrite)
    })

    it("offers convert to link_to for anchor tags", () => {
      const content = '<a href="/home">Home</a>'

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const convertAction = actions.find(a => a.title.includes("link_to"))
      expect(convertAction).toBeDefined()
      expect(convertAction!.title).toBe("Herb: Convert to `link_to`")
    })

    it("includes a text edit that replaces with tag helper", () => {
      const content = "<div>hello</div>"

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const convertAction = actions.find(a => a.title.includes("tag.div"))
      expect(convertAction).toBeDefined()

      const changes = convertAction!.edit!.changes!["file:///test.html.erb"]
      expect(changes).toHaveLength(1)
      expect(changes[0].newText).toContain("tag.div")
    })

    it("offers convert for span with attributes", () => {
      const content = '<span class="highlight">text</span>'

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const convertAction = actions.find(a => a.title.includes("tag.span"))
      expect(convertAction).toBeDefined()
    })
  })

  describe("no actions", () => {
    it("returns no rewrite actions for plain text", () => {
      const content = "just some text"

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const rewriteActions = actions.filter(a => a.kind === CodeActionKind.RefactorRewrite)
      expect(rewriteActions).toHaveLength(0)
    })

    it("returns no rewrite actions for regular ERB", () => {
      const content = "<%= some_method %>"

      const actions = getCodeActions(content, 0, 0, 0, content.length)

      const rewriteActions = actions.filter(a => a.kind === CodeActionKind.RefactorRewrite)
      expect(rewriteActions).toHaveLength(0)
    })

    it("does not offer actions when cursor is outside element range", () => {
      const content = dedent`
        <p>before</p>
        <%= tag.div do %>
          Content
        <% end %>
        <p>after</p>
      `

      const actions = getCodeActions(content, 0, 0, 0, 14)

      const divAction = actions.find(a => a.title.includes("<div>"))
      expect(divAction).toBeUndefined()
    })
  })
})
