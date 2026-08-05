import { describe, it, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"

import { ParserService } from "../src/parser_service"
import { LineContextCollector } from "../src/line_context_collector"

import {
  commentERBNode,
  uncommentERBNode,
  determineStrategy,
  commentLineContent,
  uncommentLineContent,
} from "../src/comment_ast_utils"

describe("comment_ast_utils", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
  })

  function parseAndCollect(content: string) {
    const parseResult = parserService.parseContent(content, { track_whitespace: true })
    const collector = new LineContextCollector()

    parseResult.visit(collector)

    return { parseResult, collector }
  }

  describe("commentERBNode", () => {
    it("inserts # after <% for a control tag", () => {
      const { parseResult, collector } = parseAndCollect(`<% if true %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      commentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%# if true %>")
    })

    it("inserts # after <% for an output tag, preserving =", () => {
      const { parseResult, collector } = parseAndCollect(`<%= render "thing" %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      commentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe(`<%#= render "thing" %>`)
    })

    it("inserts # after <% for a raw output tag, preserving ==", () => {
      const { parseResult, collector } = parseAndCollect(`<%== raw_html %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      commentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%#== raw_html %>")
    })

    it("inserts # after <% for a trim tag, preserving -", () => {
      const { parseResult, collector } = parseAndCollect(`<%- code %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      commentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%#- code %>")
    })

    it("inserts # after <% for a literal percent tag, preserving %", () => {
      const { parseResult, collector } = parseAndCollect(`<%% code %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      commentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%#% code %>")
    })
  })

  describe("uncommentERBNode", () => {
    it("removes # from a simple ERB comment", () => {
      const { parseResult, collector } = parseAndCollect(`<%# comment %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<% comment %>")
    })

    it("does nothing for non-comment ERB tags", () => {
      const { parseResult, collector } = parseAndCollect(`<%= output %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%= output %>")
    })

    it("restores = from linter-formatted <%# = render %>", () => {
      const { parseResult, collector } = parseAndCollect(`<%# = render "thing" %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe(`<%= render "thing" %>`)
    })

    it("restores == from linter-formatted <%# == raw %>", () => {
      const { parseResult, collector } = parseAndCollect(`<%# == raw_html %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%== raw_html %>")
    })

    it("restores - from linter-formatted <%# - code %>", () => {
      const { parseResult, collector } = parseAndCollect(`<%# - code %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%- code %>")
    })

    it("restores % from linter-formatted <%# % code %>", () => {
      const { parseResult, collector } = parseAndCollect(`<%# % code %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%% code %>")
    })

    it("restores %= from linter-formatted <%# %= expr %>", () => {
      const { parseResult, collector } = parseAndCollect(`<%# %= expression %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%%= expression %>")
    })

    it("restores graphql from linter-formatted <%# graphql query %>", () => {
      const { parseResult, collector } = parseAndCollect(`<%# graphql { user { name } } %>`)
      const erbNode = collector.erbNodesPerLine.get(0)![0]

      uncommentERBNode(erbNode)

      expect(IdentityPrinter.print(parseResult.value, { ignoreErrors: true })).toBe("<%graphql { user { name } } %>")
    })
  })

  describe("determineStrategy", () => {
    it("returns html-only when there are no ERB nodes", () => {
      const { collector } = parseAndCollect(`<div>hello</div>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<div>hello</div>`)).toBe("html-only")
    })

    it("returns single-erb for a sole ERB tag on the line", () => {
      const { collector } = parseAndCollect(`<%= render "thing" %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<%= render "thing" %>`)).toBe("single-erb")
    })

    it("returns single-erb for an indented sole ERB tag", () => {
      const { collector } = parseAndCollect(`    <% if true %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `    <% if true %>`)).toBe("single-erb")
    })

    it("returns whole-line for a single ERB tag mixed with HTML", () => {
      const { collector } = parseAndCollect(`<h1><%= title %></h1>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<h1><%= title %></h1>`)).toBe("whole-line")
    })

    it("returns all-erb for multiple ERB tags with no HTML", () => {
      const { collector } = parseAndCollect(`<% if true %><% end %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<% if true %><% end %>`)).toBe("all-erb")
    })

    it("returns per-segment for control ERB wrapping HTML", () => {
      const { collector } = parseAndCollect(`<% if true %><div>hello</div><% end %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<% if true %><div>hello</div><% end %>`)).toBe("per-segment")
    })

    it("returns whole-line for output ERB mixed with HTML text", () => {
      const { collector } = parseAndCollect(`<%= user.name %> commented on <%= post.title %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<%= user.name %> commented on <%= post.title %>`)).toBe("whole-line")
    })

    it("returns all-erb for three control tags with no HTML", () => {
      const { collector } = parseAndCollect(`<% a %><% b %><% c %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<% a %><% b %><% c %>`)).toBe("all-erb")
    })

    it("returns all-erb for spaced control tags (whitespace-only text ignored)", () => {
      const { collector } = parseAndCollect(`<% a %> <% b %> <% c %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<% a %> <% b %> <% c %>`)).toBe("all-erb")
    })

    it("returns whole-line for mixed output and control ERB with HTML", () => {
      const { collector } = parseAndCollect(`<%= output %> text <% control %>`)
      const erbNodes = collector.erbNodesPerLine.get(0) || []

      expect(determineStrategy(erbNodes, `<%= output %> text <% control %>`)).toBe("whole-line")
    })
  })

  describe("commentLineContent", () => {
    it("wraps HTML-only content in an HTML comment", () => {
      const result = commentLineContent(`<div>hello</div>`, [], "html-only", parserService)

      expect(result).toBe("<!-- <div>hello</div> -->")
    })

    it("wraps plain text in an HTML comment", () => {
      const result = commentLineContent(`hello world`, [], "html-only", parserService)

      expect(result).toBe("<!-- hello world -->")
    })

    it("comments all ERB tags for all-erb strategy", () => {
      const { collector } = parseAndCollect(`<% if true %><% end %>`)
      const erbNodes = collector.erbNodesPerLine.get(0)!

      const result = commentLineContent(`<% if true %><% end %>`, erbNodes, "all-erb", parserService)

      expect(result).toBe("<%# if true %><%# end %>")
    })

    it("wraps entire line for whole-line strategy with ERB output", () => {
      const { collector } = parseAndCollect(`<h1><%= title %></h1>`)
      const erbNodes = collector.erbNodesPerLine.get(0)!

      const result = commentLineContent(`<h1><%= title %></h1>`, erbNodes, "whole-line", parserService)

      expect(result).toBe("<!-- <h1><%#= title %></h1> -->")
    })

    it("comments per segment for per-segment strategy", () => {
      const { collector } = parseAndCollect(`<% if true %><div>hello</div><% end %>`)
      const erbNodes = collector.erbNodesPerLine.get(0)!

      const result = commentLineContent(
        `<% if true %><div>hello</div><% end %>`,
        erbNodes,
        "per-segment",
        parserService,
      )

      expect(result).toBe("<%# if true %><!-- <div>hello</div> --><%# end %>")
    })

    it("wraps whole line with multiple output ERB tags and text", () => {
      const { collector } = parseAndCollect(`<%= first %> | <%= second %>`)
      const erbNodes = collector.erbNodesPerLine.get(0)!

      const result = commentLineContent(`<%= first %> | <%= second %>`, erbNodes, "whole-line", parserService)

      expect(result).toBe("<!-- <%#= first %> | <%#= second %> -->")
    })
  })

  describe("uncommentLineContent", () => {
    it("uncomments ERB comment tags", () => {
      const result = uncommentLineContent(`<%# if true %><%# end %>`, parserService)

      expect(result).toBe("<% if true %><% end %>")
    })

    it("unwraps an HTML comment around plain HTML", () => {
      const result = uncommentLineContent(`<!-- <div>hello</div> -->`, parserService)

      expect(result).toBe("<div>hello</div>")
    })

    it("unwraps an HTML comment and uncomments inner ERB", () => {
      const result = uncommentLineContent(`<!-- <h1><%#= title %></h1> -->`, parserService)

      expect(result).toBe("<h1><%= title %></h1>")
    })

    it("uncomments per-segment content with HTML comment and ERB comments", () => {
      const result = uncommentLineContent(
        `<%# if condition? %><!-- <div>hello</div> --><%# end %>`,
        parserService,
      )

      expect(result).toBe("<% if condition? %><div>hello</div><% end %>")
    })

    it("uncomments whole-line wrapped output ERB with text", () => {
      const result = uncommentLineContent(
        `<!-- <%#= user.name %> commented on <%#= post.title %> just now! -->`,
        parserService,
      )

      expect(result).toBe("<%= user.name %> commented on <%= post.title %> just now!")
    })

    it("unwraps plain text from an HTML comment", () => {
      const result = uncommentLineContent(`<!-- hello world -->`, parserService)

      expect(result).toBe("hello world")
    })

    it("handles content with no comments (passthrough)", () => {
      const result = uncommentLineContent(`<div>hello</div>`, parserService)

      expect(result).toBe("<div>hello</div>")
    })

    it("uncomments a single ERB comment", () => {
      const result = uncommentLineContent(`<%# render "thing" %>`, parserService)

      expect(result).toBe(`<% render "thing" %>`)
    })

    it("uncomments three ERB comment tags", () => {
      const result = uncommentLineContent(`<%# a %><%# b %><%# c %>`, parserService)

      expect(result).toBe("<% a %><% b %><% c %>")
    })
  })
})
