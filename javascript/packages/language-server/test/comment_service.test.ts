import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { CommentService } from "../src/comment_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("CommentService", () => {
  let parserService: ParserService
  let service: CommentService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new CommentService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function lineRange(startLine: number, endLine?: number): Range {
    return Range.create(startLine, 0, endLine ?? startLine, 0)
  }

  function applyEdits(content: string, edits: { range: Range, newText: string }[]): string {
    const sorted = [...edits].sort((a, b) => {
      if (a.range.start.line !== b.range.start.line) {
        return b.range.start.line - a.range.start.line
      }

      return b.range.start.character - a.range.start.character
    })

    let result = content

    for (const edit of sorted) {
      const document = TextDocument.create("file:///temp.erb", "erb", 1, result)
      const startOffset = document.offsetAt(edit.range.start)
      const endOffset = document.offsetAt(edit.range.end)

      result = result.substring(0, startOffset) + edit.newText + result.substring(endOffset)
    }

    return result
  }

  describe("toggleLineComment", () => {
    describe("commenting", () => {
      it("comments a single ERB output line by inserting #", () => {
        const original = `<%= render "thing" %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%#= render "thing" %>`)
      })

      it("comments a single ERB control line by inserting #", () => {
        const original = `<% if true %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%# if true %>`)
      })

      it("comments an HTML line", () => {
        const original = `<div>hello</div>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <div>hello</div> -->")
      })

      it("comments an indented HTML line preserving indentation", () => {
        const original = `  <div>hello</div>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("  <!-- <div>hello</div> -->")
      })

      it("skips empty lines", () => {
        const document = createDocument(``)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(0)
      })

      it("skips whitespace-only lines", () => {
        const document = createDocument(`   `)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(0)
      })
    })

    describe("mixed content lines", () => {
      it("comments each segment when ERB wraps HTML content", () => {
        const original = `<% if condition? %><div>hello</div><% end %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<%# if condition? %><!-- <div>hello</div> --><%# end %>")
      })

      it("wraps HTML with embedded ERB output in an HTML comment and comments ERB tags", () => {
        const original = `<h1><%= @record.title %></h1>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <h1><%#= @record.title %></h1> -->")
      })

      it("wraps indented mixed content preserving indentation and comments ERB tags", () => {
        const original = `  <h1><%= @record.title %></h1>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("  <!-- <h1><%#= @record.title %></h1> -->")
      })

      it("comments multiple ERB tags on a single line by inserting # into each", () => {
        const original = `<% if true %><% end %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<%# if true %><%# end %>")
      })

      it("wraps whole line when HTML content surrounds multiple ERB tags", () => {
        const original = `<%= user.name %> commented on <%= post.title %> just now!`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <%#= user.name %> commented on <%#= post.title %> just now! -->")
      })

      it("wraps whole line when ERB output tags are at both edges with HTML between", () => {
        const original = `<%= user.name %> commented on <%= post.title %> just now! <%= post.id %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <%#= user.name %> commented on <%#= post.title %> just now! <%#= post.id %> -->")
      })

      it("still uses # for a single ERB tag on a line", () => {
        const original = `<% if true %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<%# if true %>")
      })

      it("comments an indented single ERB tag by inserting #", () => {
        const original = `    <%= render "partial" %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`    <%#= render "partial" %>`)
      })

      it("comments plain text as HTML content", () => {
        const original = `hello world`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- hello world -->")
      })

      it("comments indented plain text preserving indentation", () => {
        const original = `    hello world`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("    <!-- hello world -->")
      })

      it("comments a self-closing HTML tag", () => {
        const original = `<br />`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <br /> -->")
      })

      it("comments multiple control ERB tags wrapping an HTML element", () => {
        const original = `<% unless disabled? %><input type="text"><% end %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%# unless disabled? %><!-- <input type="text"> --><%# end %>`)
      })

      it("comments ERB output tag embedded in an HTML attribute", () => {
        const original = `<div class="<%= active_class %>">content</div>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<!-- <div class="<%#= active_class %>">content</div> -->`)
      })

      it("comments a line with only ERB output tags and text between them", () => {
        const original = `<%= first %> | <%= second %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<!-- <%#= first %> | <%#= second %> -->`)
      })

      it("comments a line with three control ERB tags and no HTML", () => {
        const original = `<% a %><% b %><% c %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%# a %><%# b %><%# c %>`)
      })

      it("comments multiple adjacent ERB output tags as all-erb", () => {
        const original = `<%= a %><%= b %><%= c %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%#= a %><%#= b %><%#= c %>`)
      })

      it("wraps whole line when ERB output tags are separated by spaces", () => {
        const original = `<%= a %> <%= b %> <%= c %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%#= a %> <%#= b %> <%#= c %>`)
      })

      it("wraps whole line when ERB output tags are separated by pipes", () => {
        const original = `<%= a %> | <%= b %> | <%= c %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<!-- <%#= a %> | <%#= b %> | <%#= c %> -->`)
      })

      it("comments spaced ERB tags as all-erb, ignoring whitespace-only text", () => {
        const original = `<% a %> <% b %> <% c %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%# a %> <%# b %> <%# c %>`)
      })

      it("comments control ERB tags separated by pipes per-segment", () => {
        const original = `<% a %> | <% b %> | <% c %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%# a %><!--  |  --><%# b %><!--  |  --><%# c %>`)
      })

      it("comments mixed output and control ERB tags with no HTML as all-erb", () => {
        const original = `<%= output %><% control %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%#= output %><%# control %>`)
      })

      it("comments ERB with trim closing tag", () => {
        const original = `<%= foo -%>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%#= foo -%>`)
      })

      it("comments a line with an inline HTML comment using if-false wrapping", () => {
        const original = `<div><!-- TODO --></div>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<% if false %><div><!-- TODO --></div><% end %>")
      })

      it("round-trips a line with an inline HTML comment", () => {
        const original = `<div><!-- TODO --></div>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe("<% if false %><div><!-- TODO --></div><% end %>")

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("comments an indented line with an inline HTML comment using if-false wrapping", () => {
        const original = `  <div><!-- TODO --></div>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("  <% if false %><div><!-- TODO --></div><% end %>")
      })
    })

    describe("invalid syntax", () => {
      it("wraps an unclosed ERB tag in an HTML comment", () => {
        const original = `<% if true`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <% if true -->")
      })

      it("wraps an unclosed HTML tag in an HTML comment", () => {
        const original = `<div>hello`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <div>hello -->")
      })

      it("wraps a stray %> in an HTML comment", () => {
        const original = `some text %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- some text %> -->")
      })

      it("wraps a stray <% in an HTML comment", () => {
        const original = `<% broken`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <% broken -->")
      })

      it("wraps mismatched HTML tags in an HTML comment", () => {
        const original = `<div><span></div></span>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <div><span></div></span> -->")
      })

      it("comments an empty ERB tag by inserting #", () => {
        const original = `<% %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<%# %>")
      })

      it("wraps a lone <%= in an HTML comment", () => {
        const original = `<%=`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<!-- <%= -->")
      })
    })

    describe("uncommenting", () => {
      it("uncomments an ERB comment by removing #", () => {
        const original = `<%# render "thing" %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<% render "thing" %>`)
      })

      it("uncomments HTML wrapped in an HTML comment", () => {
        const original = `<!-- <div>hello</div> -->`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<div>hello</div>")
      })

      it("uncomments HTML wrapped in an ERB comment", () => {
        const original = `<%# <div>hello</div> %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("<div>hello</div>")
      })

      it("uncomments an indented ERB comment preserving indentation", () => {
        const original = `  <%# <div>hello</div> %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("  <div>hello</div>")
      })

      it("uncomments <%# = render %> back to <%= render %>", () => {
        const original = `<%# = render "thing" %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%= render "thing" %>`)
      })

      it("uncomments <%# == raw %> back to <%== raw %>", () => {
        const original = `<%# == raw_html %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%== raw_html %>`)
      })

      it("uncomments <%# - code %> back to <%- code %>", () => {
        const original = `<%# - code %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%- code %>`)
      })

      it("uncomments <%# % code %> back to <%% code %>", () => {
        const original = `<%# % code %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%% code %>`)
      })

      it("uncomments <%# %= expression %> back to <%%= expression %>", () => {
        const original = `<%# %= expression %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%%= expression %>`)
      })

      it("uncomments <%# graphql query %> back to <%graphql query %>", () => {
        const original = `<%# graphql { user { name } } %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%graphql { user { name } } %>`)
      })

      it("uncomments an indented HTML comment preserving indentation", () => {
        const original = `    <!-- <div>hello</div> -->`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("    <div>hello</div>")
      })

      it("uncomments per-segment commented line", () => {
        const original = `<%# if condition? %><!-- <div>hello</div> --><%# end %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<% if condition? %><div>hello</div><% end %>`)
      })

      it("uncomments whole-line commented mixed content", () => {
        const original = `<!-- <h1><%#= @record.title %></h1> -->`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<h1><%= @record.title %></h1>`)
      })

      it("uncomments multiple ERB-only comment tags", () => {
        const original = `<%# if true %><%# end %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<% if true %><% end %>`)
      })

      it("uncomments whole-line commented ERB output with text", () => {
        const original = `<!-- <%#= user.name %> commented on <%#= post.title %> just now! -->`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe(`<%= user.name %> commented on <%= post.title %> just now!`)
      })

      it("uncomments plain text from HTML comment", () => {
        const original = `<!-- hello world -->`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(applyEdits(original, edits)).toBe("hello world")
      })
    })

    describe("mixed selection", () => {
      it("comments all lines when some are not commented", () => {
        const content = dedent`
          <% if true %>
          <%# already commented %>
        `

        const document = createDocument(content)
        const edits = service.toggleLineComment(document, lineRange(0, 1))

        expect(edits.length).toBeGreaterThanOrEqual(1)

        const commentEdit = edits.find(edit => edit.newText === "#")
        expect(commentEdit).toBeDefined()
      })

      it("uncomments all lines when all are commented", () => {
        const content = dedent`
          <%# first comment %>
          <%# second comment %>
        `

        const document = createDocument(content)
        const edits = service.toggleLineComment(document, lineRange(0, 1))

        expect(edits.length).toBe(2)
        expect(edits.every(edit => edit.newText === "")).toBe(true)
      })

      it("skips empty lines in selection", () => {
        const content = `<% if true %>\n\n<% end %>`

        const document = createDocument(content)
        const edits = service.toggleLineComment(document, lineRange(0, 2))

        expect(edits.length).toBe(2)
      })
    })

    describe("multiline selection with mixed HTML and ERB", () => {
      it("comments HTML and ERB lines correctly", () => {
        const content = dedent`
          <div>hello</div>
          <%= render "partial" %>
        `

        const document = createDocument(content)
        const edits = service.toggleLineComment(document, lineRange(0, 1))

        expect(edits.length).toBe(2)
      })
    })

    describe("round-trip (comment then uncomment)", () => {
      it("round-trips a single ERB output line preserving <%=", () => {
        const original = `<%= render "thing" %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#= render "thing" %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips a linter-formatted commented output tag", () => {
        const linterFormatted = `<%# = render "thing" %>`
        const document = createDocument(linterFormatted)
        const uncommented = applyEdits(linterFormatted, service.toggleLineComment(document, lineRange(0)))

        expect(uncommented).toBe(`<%= render "thing" %>`)
      })

      it("round-trips a single HTML line", () => {
        const original = `<div>hello</div>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <div>hello</div> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips mixed ERB + HTML content", () => {
        const original = `<h1><%= @record.title %></h1>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <h1><%#= @record.title %></h1> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips multiple ERB tags with HTML on a single line", () => {
        const original = `<% if condition? %><div>hello</div><% end %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# if condition? %><!-- <div>hello</div> --><%# end %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips HTML content surrounding multiple ERB tags", () => {
        const original = `<%= user.name %> commented on <%= post.title %> just now!`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <%#= user.name %> commented on <%#= post.title %> just now! -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips multiple ERB-only tags on a single line", () => {
        const original = `<% if true %><% end %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# if true %><%# end %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips a single ERB control line", () => {
        const original = `<% if true %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# if true %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips <%== raw output tag", () => {
        const original = `<%== raw_html %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#== raw_html %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips <%- trim tag", () => {
        const original = `<%- code %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#- code %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips <%% literal percent tag", () => {
        const original = `<%% code %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#% code %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips <%%= literal percent output tag", () => {
        const original = `<%%= expression %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#%= expression %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips <%graphql tag", () => {
        const original = `<%graphql { user { name } } %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#graphql { user { name } } %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips linter-formatted <%# == raw %>", () => {
        const linterFormatted = `<%# == raw_html %>`
        const document = createDocument(linterFormatted)
        const uncommented = applyEdits(linterFormatted, service.toggleLineComment(document, lineRange(0)))

        expect(uncommented).toBe(`<%== raw_html %>`)
      })

      it("round-trips linter-formatted <%# - code %>", () => {
        const linterFormatted = `<%# - code %>`
        const document = createDocument(linterFormatted)
        const uncommented = applyEdits(linterFormatted, service.toggleLineComment(document, lineRange(0)))

        expect(uncommented).toBe(`<%- code %>`)
      })

      it("round-trips linter-formatted <%# % code %>", () => {
        const linterFormatted = `<%# % code %>`
        const document = createDocument(linterFormatted)
        const uncommented = applyEdits(linterFormatted, service.toggleLineComment(document, lineRange(0)))

        expect(uncommented).toBe(`<%% code %>`)
      })

      it("round-trips linter-formatted <%# %= expression %>", () => {
        const linterFormatted = `<%# %= expression %>`
        const document = createDocument(linterFormatted)
        const uncommented = applyEdits(linterFormatted, service.toggleLineComment(document, lineRange(0)))

        expect(uncommented).toBe(`<%%= expression %>`)
      })

      it("round-trips linter-formatted <%# graphql query %>", () => {
        const linterFormatted = `<%# graphql { user { name } } %>`
        const document = createDocument(linterFormatted)
        const uncommented = applyEdits(linterFormatted, service.toggleLineComment(document, lineRange(0)))

        expect(uncommented).toBe(`<%graphql { user { name } } %>`)
      })

      it("round-trips plain text", () => {
        const original = `hello world`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- hello world -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips indented HTML", () => {
        const original = `    <div>hello</div>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`    <!-- <div>hello</div> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips an indented ERB output tag", () => {
        const original = `    <%= render "partial" %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`    <%#= render "partial" %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips a self-closing HTML tag", () => {
        const original = `<br />`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <br /> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips ERB output embedded in an HTML attribute", () => {
        const original = `<div class="<%= active_class %>">content</div>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <div class="<%#= active_class %>">content</div> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips ERB output tags separated by a pipe", () => {
        const original = `<%= first %> | <%= second %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <%#= first %> | <%#= second %> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips three control ERB tags with no HTML", () => {
        const original = `<% a %><% b %><% c %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# a %><%# b %><%# c %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips multiple adjacent ERB output tags", () => {
        const original = `<%= a %><%= b %><%= c %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#= a %><%#= b %><%#= c %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips ERB output tags separated by spaces", () => {
        const original = `<%= a %> <%= b %> <%= c %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#= a %> <%#= b %> <%#= c %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips ERB output tags separated by pipes", () => {
        const original = `<%= a %> | <%= b %> | <%= c %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<!-- <%#= a %> | <%#= b %> | <%#= c %> -->`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips control ERB tags separated by pipes", () => {
        const original = `<% a %> | <% b %> | <% c %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# a %><!--  |  --><%# b %><!--  |  --><%# c %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips spaced ERB-only tags", () => {
        const original = `<% a %> <% b %> <% c %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# a %> <%# b %> <%# c %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips control ERB wrapping an input element", () => {
        const original = `<% unless disabled? %><input type="text"><% end %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%# unless disabled? %><!-- <input type="text"> --><%# end %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips an indented multiline template", () => {
        const original = dedent`
          <div>
            <h1><%= @title %></h1>
            <% if @show_body %>
              <p><%= @body %></p>
            <% end %>
          </div>
        `
        const lineCount = original.split('\n').length
        const range = lineRange(0, lineCount - 1)

        const document1 = createDocument(original)
        const commentEdits = service.toggleLineComment(document1, range)
        const commented = applyEdits(original, commentEdits)

        const document2 = createDocument(commented)
        const uncommentEdits = service.toggleLineComment(document2, range)
        const uncommented = applyEdits(commented, uncommentEdits)

        expect(uncommented).toBe(original)
      })

      it("round-trips an HTML comment that spans its own line", () => {
        const original = `<!-- TODO: refactor this -->`
        const document1 = createDocument(original)
        const uncommentEdits = service.toggleLineComment(document1, lineRange(0))
        const uncommented = applyEdits(original, uncommentEdits)

        expect(uncommented).toBe(`TODO: refactor this`)

        const document2 = createDocument(uncommented)
        const commentEdits = service.toggleLineComment(document2, lineRange(0))
        const recommented = applyEdits(uncommented, commentEdits)

        expect(recommented).toBe(`<!-- TODO: refactor this -->`)
      })

      it("commenting is idempotent when already commented ERB lines are skipped", () => {
        const original = `<%# already commented %>`
        const document = createDocument(original)
        const edits = service.toggleLineComment(document, lineRange(0))

        const result = applyEdits(original, edits)
        expect(result).toBe(`<% already commented %>`)
      })

      it("round-trips ERB with trim closing tag", () => {
        const original = `<%= foo -%>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#= foo -%>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips mixed output and control ERB with no HTML", () => {
        const original = `<%= output %><% control %>`
        const document1 = createDocument(original)
        const commented = applyEdits(original, service.toggleLineComment(document1, lineRange(0)))

        expect(commented).toBe(`<%#= output %><%# control %>`)

        const document2 = createDocument(commented)
        const uncommented = applyEdits(commented, service.toggleLineComment(document2, lineRange(0)))

        expect(uncommented).toBe(original)
      })

      it("round-trips a real-world ERB template", () => {
        const original = dedent`
          <% @records.each do |record| %>
            <article
              class="card"
              data-controller="card"
              data-card-id="<%= record.id %>"
            >
              <h3><%= record.title %></h3>
              <p><%= record.description %></p>
            </article>
          <% end %>
        `
        const lineCount = original.split('\n').length
        const range = lineRange(0, lineCount - 1)

        const document1 = createDocument(original)
        const commentEdits = service.toggleLineComment(document1, range)
        const commented = applyEdits(original, commentEdits)

        for (const line of commented.split('\n')) {
          if (line.trim() === '') continue
          expect(line).toMatch(/<%#|<!--/)
        }

        const document2 = createDocument(commented)
        const uncommentEdits = service.toggleLineComment(document2, range)
        const uncommented = applyEdits(commented, uncommentEdits)

        expect(uncommented).toBe(original)

        const document3 = createDocument(uncommented)
        const commentEdits2 = service.toggleLineComment(document3, range)
        const commented2 = applyEdits(uncommented, commentEdits2)

        const document4 = createDocument(commented2)
        const uncommentEdits2 = service.toggleLineComment(document4, range)
        const uncommented2 = applyEdits(commented2, uncommentEdits2)

        expect(uncommented2).toBe(original)
      })
    })
  })

  describe("toggleBlockComment", () => {
    describe("wrapping", () => {
      it("wraps selection with <% if false %> ... <% end %>", () => {
        const content = dedent`
          <div>hello</div>
          <%= render "thing" %>
        `

        const document = createDocument(content)
        const edits = service.toggleBlockComment(document, lineRange(0, 1))

        expect(edits).toHaveLength(2)

        const endEdit = edits.find(edit => edit.newText.includes("<% end %>"))
        expect(endEdit).toBeDefined()

        const startEdit = edits.find(edit => edit.newText.includes("<% if false %>"))
        expect(startEdit).toBeDefined()
      })

      it("preserves indentation when wrapping", () => {
        const content = `  <div>hello</div>`

        const document = createDocument(content)
        const edits = service.toggleBlockComment(document, lineRange(0, 0))

        const startEdit = edits.find(edit => edit.newText.includes("<% if false %>"))
        expect(startEdit?.newText).toBe("  <% if false %>\n")
      })
    })

    describe("round-trip", () => {
      it("round-trips block comment wrapping and unwrapping", () => {
        const wrapped = dedent`
          <% if false %>
          <div>hello</div>
          <%= render "thing" %>
          <% end %>
        `

        const document = createDocument(wrapped)
        const unwrapEdits = service.toggleBlockComment(document, lineRange(0, 3))

        expect(unwrapEdits).toHaveLength(2)
        expect(unwrapEdits.every(e => e.newText === "")).toBe(true)

        const unwrapped = applyEdits(wrapped, unwrapEdits)

        expect(unwrapped.trim()).toBe(dedent`
          <div>hello</div>
          <%= render "thing" %>
        `.trim())
      })
    })

describe("unwrapping", () => {
      it("removes <% if false %> ... <% end %> wrapper", () => {
        const content = dedent`
          <% if false %>
          <div>hello</div>
          <% end %>
        `

        const document = createDocument(content)
        const edits = service.toggleBlockComment(document, lineRange(0, 2))

        expect(edits).toHaveLength(2)

        for (const edit of edits) {
          expect(edit.newText).toBe("")
        }
      })
    })
  })
})
