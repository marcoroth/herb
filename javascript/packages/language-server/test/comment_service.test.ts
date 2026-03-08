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

  describe("toggleLineComment", () => {
    describe("commenting", () => {
      it("comments a single ERB output line by inserting #", () => {
        const document = createDocument(`<%= render "thing" %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("#")
        expect(edits[0].range.start.character).toBe(2)
      })

      it("comments a single ERB control line by inserting #", () => {
        const document = createDocument(`<% if true %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("#")
        expect(edits[0].range.start.character).toBe(2)
      })

      it("comments an HTML line", () => {
        const document = createDocument(`<div>hello</div>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<!-- <div>hello</div> -->")
      })

      it("comments an indented HTML line preserving indentation", () => {
        const document = createDocument(`  <div>hello</div>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("  <!-- <div>hello</div> -->")
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
        const document = createDocument(`<% if condition? %><div>hello</div><% end %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<%# if condition? %><!-- <div>hello</div> --><%# end %>")
      })

      it("wraps HTML with embedded ERB output in an HTML comment and comments ERB tags", () => {
        const document = createDocument(`<h1><%= @record.title %></h1>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<!-- <h1><%#= @record.title %></h1> -->")
      })

      it("wraps indented mixed content preserving indentation and comments ERB tags", () => {
        const document = createDocument(`  <h1><%= @record.title %></h1>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("  <!-- <h1><%#= @record.title %></h1> -->")
      })

      it("comments multiple ERB tags on a single line by inserting # into each", () => {
        const document = createDocument(`<% if true %><% end %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<%# if true %><%# end %>")
      })

      it("wraps whole line when HTML content surrounds multiple ERB tags", () => {
        const document = createDocument(`<%= user.name %> commented on <%= post.title %> just now!`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<!-- <%#= user.name %> commented on <%#= post.title %> just now! -->")
      })

      it("wraps whole line when ERB output tags are at both edges with HTML between", () => {
        const document = createDocument(`<%= user.name %> commented on <%= post.title %> just now! <%= post.id %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<!-- <%#= user.name %> commented on <%#= post.title %> just now! <%#= post.id %> -->")
      })

      it("still uses # for a single ERB tag on a line", () => {
        const document = createDocument(`<% if true %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("#")
      })
    })

    describe("uncommenting", () => {
      it("uncomments an ERB comment by removing #", () => {
        const document = createDocument(`<%# render "thing" %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(3)
      })

      it("uncomments HTML wrapped in an HTML comment", () => {
        const document = createDocument(`<!-- <div>hello</div> -->`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("<div>hello</div>")
      })

      it("uncomments HTML wrapped in an ERB comment", () => {
        const document = createDocument(`<%# <div>hello</div> %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toContain("<div>hello</div>")
        expect(edits[0].newText).not.toContain("<%#")
        expect(edits[0].newText).not.toContain("%>")
      })

      it("uncomments an indented ERB comment preserving indentation", () => {
        const document = createDocument(`  <%# <div>hello</div> %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("  <div>hello</div>")
      })

      it("uncomments <%# = render %> back to <%= render %>", () => {
        const document = createDocument(`<%# = render "thing" %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(4)
      })

      it("uncomments <%# == raw %> back to <%== raw %>", () => {
        const document = createDocument(`<%# == raw_html %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(4)
      })

      it("uncomments <%# - code %> back to <%- code %>", () => {
        const document = createDocument(`<%# - code %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(4)
      })

      it("uncomments <%# % code %> back to <%% code %>", () => {
        const document = createDocument(`<%# % code %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(4)
      })

      it("uncomments <%# %= expression %> back to <%%= expression %>", () => {
        const document = createDocument(`<%# %= expression %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(4)
      })

      it("uncomments <%# graphql query %> back to <%graphql query %>", () => {
        const document = createDocument(`<%# graphql { user { name } } %>`)
        const edits = service.toggleLineComment(document, lineRange(0))

        expect(edits).toHaveLength(1)
        expect(edits[0].newText).toBe("")
        expect(edits[0].range.start.character).toBe(2)
        expect(edits[0].range.end.character).toBe(4)
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
      function applyEdits(content: string, edits: { range: { start: { line: number, character: number }, end: { line: number, character: number } }, newText: string }[]): string {
        const lines = content.split('\n')
        const sorted = [...edits].sort((a, b) => {
          if (a.range.start.line !== b.range.start.line) {
            return b.range.start.line - a.range.start.line
          }

          return b.range.start.character - a.range.start.character
        })

        for (const edit of sorted) {
          const line = lines[edit.range.start.line]
          const before = line.substring(0, edit.range.start.character)
          const after = line.substring(edit.range.end.character)

          lines[edit.range.start.line] = before + edit.newText + after
        }

        return lines.join('\n')
      }

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
