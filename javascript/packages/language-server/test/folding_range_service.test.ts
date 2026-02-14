import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { FoldingRangeKind } from "vscode-languageserver/node"

import { FoldingRangeService } from "../src/folding_range_service"
import { Herb } from "@herb-tools/node-wasm"

describe("FoldingRangeService", () => {
  let service: FoldingRangeService

  beforeAll(async () => {
    await Herb.load()
    service = new FoldingRangeService()
  })

  describe("HTML elements", () => {
    it("creates folding ranges for multi-line HTML elements", () => {
      const content = dedent`
        <div>
          <p>
            Hello
          </p>
        </div>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 4],
        [1, 3]
      ])
    })

    it("does not create folding ranges for void elements", () => {
      const content = dedent`
        <div>
          <br>
          <img src="test.png">
        </div>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 3]
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 9],
        [1, 8],
        [2, 4],
        [5, 7]
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine, range.kind])).toEqual([
        [0, 2, FoldingRangeKind.Comment]
      ])
    })

    it("does not create folding ranges for single-line comments", () => {
      const content = dedent`
        <!-- Single line comment -->
        <div>Content</div>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges).toEqual([])
    })
  })

  describe("ERB control flow", () => {
    it("creates folding ranges for if blocks", () => {
      const content = dedent`
        <% if condition %>
          <p>True</p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 2],
        [0, 2]
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 4],
        [0, 2],
        [2, 4],
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.length).toBeGreaterThanOrEqual(3)
    })

    it("creates folding ranges for unless blocks", () => {
      const content = dedent`
        <% unless condition %>
          <p>False</p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 2]
      ])
    })

    it("creates folding ranges for each blocks", () => {
      const content = dedent`
        <% items.each do |item| %>
          <li><%= item %></li>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 2]
      ])
    })

    it("creates folding ranges for while blocks", () => {
      const content = dedent`
        <% while condition %>
          <p>Loop</p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 2]
      ])
    })

    it("creates folding ranges for for blocks", () => {
      const content = dedent`
        <% for i in 1..10 %>
          <p><%= i %></p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 2]
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 4]
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 12],
        [1, 11],
        [1, 9],
        [2, 8],
        [3, 7],
        [4, 6],
        [9, 11]
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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [0, 5],
        [0, 3]
      ])
    })
  })

  describe("edge cases", () => {
    it("handles empty document", () => {
      const content = ""

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges).toEqual([])
    })

    it("handles document with only text", () => {
      const content = "Just plain text"

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges).toEqual([])
    })

    it("does not create ranges for single-line elements", () => {
      const content = "<div>Single line</div>"

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

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

      const parseResult = Herb.parse(content)
      const ranges = service.getFoldingRanges(parseResult.value)

      expect(ranges.map(range => [range.startLine, range.endLine])).toEqual([
        [1, 59],
        [2, 4],
        [5, 58],
        [6, 7],
        [8, 57],
        [9, 21],
        [9, 19],
        [11, 18],
        [12, 17],
        [13, 16],
        [19, 21],
        [23, 25],
        [29, 31],
        [33, 35],
        [37, 39],
        [42, 48],
        [50, 52],
        [54, 56],
      ])
    })
  })
})
