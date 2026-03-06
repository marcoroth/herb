import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { FoldingRangeKind } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { FoldingRangeService } from "../src/folding_range_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("FoldingRangeService", () => {
  let parserService: ParserService
  let service: FoldingRangeService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new FoldingRangeService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  describe("HTML elements", () => {
    it("creates folding ranges for multi-line HTML elements", () => {
      const content = dedent`
        <div>
          <p>
            Hello
          </p>
        </div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 5, endLine: 3, endCharacter: 0 },
        { startLine: 1, startCharacter: 5, endLine: 2, endCharacter: 2 },
      ])
    })

    it("does not create folding ranges for void elements", () => {
      const content = dedent`
        <div>
          <br>
          <img src="test.png">
        </div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 5, endLine: 2, endCharacter: 0 },
      ])
    })

    it("handles nested HTML elements", () => {
      const content = dedent`
        <div class="container">
          <ul>
            <li>
              Item 1
            </li>
            <li>
              Item 2
            </li>
          </ul>
        </div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 23, endLine: 8, endCharacter: 0 },
        { startLine: 1, startCharacter: 6, endLine: 7, endCharacter: 2 },
        { startLine: 2, startCharacter: 8, endLine: 3, endCharacter: 4 },
        { startLine: 5, startCharacter: 8, endLine: 6, endCharacter: 4 },
      ])
    })
  })

  describe("HTML comments", () => {
    it("creates folding ranges for multi-line comments", () => {
      const content = dedent`
        <!-- This is a comment
             that spans multiple
             lines -->
        <div>Content</div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 4, endLine: 1, endCharacter: 11, kind: FoldingRangeKind.Comment },
      ])
    })

    it("does not create folding ranges for single-line comments", () => {
      const content = dedent`
        <!-- Single line comment -->
        <div>Content</div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([])
    })
  })

  describe("CDATA", () => {
    it("creates folding ranges for multi-line CDATA", () => {
      const content = `<![CDATA[\n  This is a CDATA section that spans multiple lines and should be\n  foldable\n]]>`

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 0, endLine: 2, endCharacter: 3 },
      ])
    })
  })

  describe("ERB control flow", () => {
    it("creates folding ranges for if blocks", () => {
      const content = dedent`
        <% if condition %>
          <p>True</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 18, endLine: 1, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for if/else blocks", () => {
      const content = dedent`
        <% if condition %>
          <p>True</p>
        <% else %>
          <p>False</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 18, endLine: 1, endCharacter: 0 },
        { startLine: 2, startCharacter: 0, endLine: 3, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for if/elsif/else blocks", () => {
      const content = dedent`
        <% if condition1 %>
          <p>First</p>
        <% elsif condition2 %>
          <p>Second</p>
        <% else %>
          <p>Third</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges.length).toBeGreaterThanOrEqual(3)
    })

    it("creates folding ranges for unless blocks", () => {
      const content = dedent`
        <% unless condition %>
          <p>False</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 22, endLine: 1, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for each blocks", () => {
      const content = dedent`
        <% items.each do |item| %>
          <li><%= item %></li>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 26, endLine: 1, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for while blocks", () => {
      const content = dedent`
        <% while condition %>
          <p>Loop</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 21, endLine: 1, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for for blocks", () => {
      const content = dedent`
        <% for i in 1..10 %>
          <p><%= i %></p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 20, endLine: 1, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for begin/rescue blocks", () => {
      const content = dedent`
        <% begin %>
          <%= risky_operation %>
        <% rescue %>
          <p>Error</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 11, endLine: 1, endCharacter: 0 },
        { startLine: 2, startCharacter: 12, endLine: 3, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for begin/rescue/ensure blocks", () => {
      const content = dedent`
        <% begin %>
          <%= risky_operation %>
        <% rescue StandardError => e %>
          <p>Error: <%= e.message %></p>
        <% ensure %>
          <p>Cleanup</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 11, endLine: 1, endCharacter: 0 },
        { startLine: 2, startCharacter: 31, endLine: 3, endCharacter: 0 },
        { startLine: 4, startCharacter: 12, endLine: 5, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for begin/rescue/else/ensure blocks", () => {
      const content = dedent`
        <% begin %>
          <%= risky_operation %>
        <% rescue => e %>
          <p>Error</p>
        <% else %>
          <p>Success</p>
        <% ensure %>
          <p>Cleanup</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 11, endLine: 1, endCharacter: 0 },
        { startLine: 2, startCharacter: 17, endLine: 3, endCharacter: 0 },
        { startLine: 4, startCharacter: 10, endLine: 5, endCharacter: 0 },
        { startLine: 6, startCharacter: 12, endLine: 7, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for begin with multiple rescue blocks", () => {
      const content = dedent`
        <% begin %>
          <%= risky_operation %>
        <% rescue ArgumentError %>
          <p>Argument Error</p>
        <% rescue StandardError %>
          <p>Standard Error</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 0, startCharacter: 11, endLine: 1, endCharacter: 0 },
        { startLine: 2, startCharacter: 26, endLine: 3, endCharacter: 0 },
        { startLine: 4, startCharacter: 26, endLine: 5, endCharacter: 0 },
      ])
    })

    it("creates folding ranges for case/when blocks", () => {
      const content = dedent`
        <% case role %>
        <% when "admin" %>
          <p>Admin</p>
        <% when "user" %>
          <p>User</p>
        <% else %>
          <p>Guest</p>
        <% end %>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 1, startCharacter: 18, endLine: 2, endCharacter: 0 },
        { startLine: 3, startCharacter: 17, endLine: 4, endCharacter: 0 },
        { startLine: 5, startCharacter: 10, endLine: 6, endCharacter: 0 },
      ])
    })
  })

  describe("complex nesting", () => {
    it("handles nested ERB and HTML correctly", () => {
      const content = dedent`
        <div class="container">
          <% if user.logged_in? %>
            <ul>
              <% items.each do |item| %>
                <li>
                  <%= item %>
                </li>
              <% end %>
            </ul>
          <% else %>
            <p>Please log in</p>
          <% end %>
        </div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 11],
        [1, 8],
        [2, 7],
        [3, 6],
        [4, 5],
        [9, 10]
      ])
    })
  })

  describe("multi-line attributes", () => {
    it("creates folding ranges for elements with multi-line attributes", () => {
      const content = dedent`
        <div
          class="container"
          data-value="test"
          id="main">
          Content
        </div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 3, startCharacter: 12, endLine: 4, endCharacter: 0 },
        { startLine: 0, startCharacter: 1, endLine: 2, endCharacter: 11 },
      ])
    })

    it("creates folding ranges for multi-line attribute values", () => {
      const content = dedent`
        <div
          class="
            flex items-center justify-between p-4
          "
          more="sdfsfsd"
          data-info="
            This is a long attribute value that should be foldable
          "
        >
          Styled content
        </div>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([
        { startLine: 8, startCharacter: 1, endLine: 9, endCharacter: 0 },
        { startLine: 0, startCharacter: 1, endLine: 7, endCharacter: 0 },
        { startLine: 1, startCharacter: 9, endLine: 2, endCharacter: 2 },
        { startLine: 5, startCharacter: 13, endLine: 6, endCharacter: 2 },
      ])
    })
  })

  describe("edge cases", () => {
    it("handles empty document", () => {
      const content = ""

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([])
    })

    it("handles document with only text", () => {
      const content = "Just plain text"

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([])
    })

    it("does not create ranges for single-line elements", () => {
      const content = "<div>Single line</div>"

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges).toEqual([])
    })
  })

  describe("whole document", () => {
    it("handles whole document", () => {
      const content = dedent`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Folding Ranges Test</title>
          </head>
          <body>
            <!-- This is a multi-line comment
                 that should be foldable -->
            <div class="container">
              <% if user.logged_in? %>
                <h1>Welcome, <%= user.name %>!</h1>
                <ul>
                  <% user.items.each do |item| %>
                    <li>
                      <span class="item-name"><%= item.name %></span>
                      <span class="item-price"><%= item.price %></span>
                    </li>
                  <% end %>
                </ul>
              <% else %>
                <h1>Please log in</h1>
              <% end %>

              <% unless user.admin? %>
                <p>You are not an admin</p>
              <% end %>

              <% case user.role %>
              <% when "admin" %>
                <div class="admin-panel">
                  <h2>Admin Panel</h2>
                </div>
              <% when "moderator" %>
                <div class="moderator-panel">
                  <h2>Moderator Panel</h2>
                </div>
              <% else %>
                <div class="user-panel">
                  <h2>User Panel</h2>
                </div>
              <% end %>

              <% begin %>
                <%= risky_operation %>
              <% rescue StandardError => e %>
                <p>Error: <%= e.message %></p>
              <% ensure %>
                <p>Cleanup</p>
              <% end %>

              <% for i in 1..10 %>
                <div class="item"><%= i %></div>
              <% end %>

              <% while counter < 10 %>
                <p><%= counter %></p>
              <% end %>
            </div>
          </body>
        </html>
      `

      const ranges = service.getFoldingRanges(createDocument(content))

      expect(ranges.length).toBeGreaterThanOrEqual(15)
    })
  })
})
