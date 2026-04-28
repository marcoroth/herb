import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { LineContextCollector } from "../src/line_context_collector"
import { ParserService } from "../src/parser_service"

describe("LineContextCollector", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
  })

  function collect(content: string) {
    const parseResult = parserService.parseContent(content, { track_whitespace: true })
    const collector = new LineContextCollector()

    parseResult.visit(collector)

    return collector
  }

  describe("lineMap", () => {
    it("classifies an ERB control tag as erb-tag", () => {
      const collector = collect(`<% if true %>`)

      expect(collector.lineMap.get(0)?.context).toBe("erb-tag")
    })

    it("classifies an ERB output tag as erb-tag", () => {
      const collector = collect(`<%= render "thing" %>`)

      expect(collector.lineMap.get(0)?.context).toBe("erb-tag")
    })

    it("classifies an ERB comment as erb-comment", () => {
      const collector = collect(`<%# comment %>`)

      expect(collector.lineMap.get(0)?.context).toBe("erb-comment")
    })

    it("classifies an HTML comment as html-comment", () => {
      const collector = collect(`<!-- comment -->`)

      expect(collector.lineMap.get(0)?.context).toBe("html-comment")
    })

    it("classifies an HTML element as html-content", () => {
      const collector = collect(`<div>hello</div>`)

      expect(collector.lineMap.get(0)?.context).toBe("html-content")
    })

    it("classifies plain text as html-content", () => {
      const collector = collect(`hello world`)

      expect(collector.lineMap.get(0)?.context).toBe("html-content")
    })

    it("prioritizes erb-tag over html-content on mixed lines", () => {
      const collector = collect(`<h1><%= title %></h1>`)

      expect(collector.lineMap.get(0)?.context).toBe("erb-tag")
    })

    it("prioritizes erb-comment over html-content", () => {
      const collector = collect(`<%# comment %> text`)

      expect(collector.lineMap.get(0)?.context).toBe("erb-comment")
    })

    it("does not override erb-tag with html-content", () => {
      const collector = collect(`<% if true %><div>hello</div><% end %>`)

      expect(collector.lineMap.get(0)?.context).toBe("erb-tag")
    })

    it("classifies multiple lines correctly", () => {
      const collector = collect(dedent`
        <% if true %>
        <div>hello</div>
        <% end %>
      `)

      expect(collector.lineMap.get(0)?.context).toBe("erb-tag")
      expect(collector.lineMap.get(1)?.context).toBe("html-content")
      expect(collector.lineMap.get(2)?.context).toBe("erb-tag")
    })

    it("classifies lines in a multiline HTML comment", () => {
      const collector = collect(dedent`
        <!--
        multiline
        comment
        -->
      `)

      expect(collector.lineMap.get(0)?.context).toBe("html-comment")
      expect(collector.lineMap.get(1)?.context).toBe("html-comment")
      expect(collector.lineMap.get(2)?.context).toBe("html-comment")
      expect(collector.lineMap.get(3)?.context).toBe("html-comment")
    })
  })

  describe("erbNodesPerLine", () => {
    it("collects a single ERB node on one line", () => {
      const collector = collect(`<%= render "thing" %>`)

      expect(collector.erbNodesPerLine.get(0)).toHaveLength(1)
      expect(collector.erbNodesPerLine.get(0)?.[0].tag_opening?.value).toBe("<%=")
    })

    it("collects multiple ERB nodes on one line", () => {
      const collector = collect(`<% if true %><% end %>`)

      expect(collector.erbNodesPerLine.get(0)).toHaveLength(2)
    })

    it("collects ERB nodes across multiple lines", () => {
      const collector = collect(dedent`
        <% if true %>
        <%= render "thing" %>
        <% end %>
      `)

      expect(collector.erbNodesPerLine.get(0)).toHaveLength(1)
      expect(collector.erbNodesPerLine.get(1)).toHaveLength(1)
      expect(collector.erbNodesPerLine.get(2)).toHaveLength(1)
    })

    it("returns undefined for lines without ERB nodes", () => {
      const collector = collect(`<div>hello</div>`)

      expect(collector.erbNodesPerLine.get(0)).toBeUndefined()
    })

    it("collects ERB comment nodes", () => {
      const collector = collect(`<%# comment %>`)

      expect(collector.erbNodesPerLine.get(0)).toHaveLength(1)
      expect(collector.erbNodesPerLine.get(0)?.[0].tag_opening?.value).toBe("<%#")
    })

    it("collects three ERB nodes on one line", () => {
      const collector = collect(`<% a %><% b %><% c %>`)

      expect(collector.erbNodesPerLine.get(0)).toHaveLength(3)
    })
  })

  describe("htmlCommentNodesPerLine", () => {
    it("collects an HTML comment node", () => {
      const collector = collect(`<!-- comment -->`)

      expect(collector.htmlCommentNodesPerLine.get(0)).toBeDefined()
      expect(collector.htmlCommentNodesPerLine.get(0)?.comment_start?.value).toBe("<!--")
    })

    it("returns undefined for lines without HTML comments", () => {
      const collector = collect(`<div>hello</div>`)

      expect(collector.htmlCommentNodesPerLine.get(0)).toBeUndefined()
    })

    it("maps all lines of a multiline HTML comment to the same node", () => {
      const collector = collect(dedent`
        <!--
        multiline
        -->
      `)

      const node = collector.htmlCommentNodesPerLine.get(0)

      expect(node).toBeDefined()
      expect(collector.htmlCommentNodesPerLine.get(1)).toBe(node)
      expect(collector.htmlCommentNodesPerLine.get(2)).toBe(node)
    })
  })
})
