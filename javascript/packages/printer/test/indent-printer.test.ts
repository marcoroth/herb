import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IndentPrinter } from "../src/index.js"

describe("IndentPrinter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function printIndented(input: string, indentWidth: number = 2): string {
    const parseResult = Herb.parse(input, { track_whitespace: true })
    expect(parseResult.value).toBeTruthy()

    const printer = new IndentPrinter(indentWidth)
    return printer.print(parseResult.value!)
  }

  describe("Basic functionality", () => {
    test("is defined", () => {
      expect(IndentPrinter).toBeDefined()
    })

    test("can be instantiated", () => {
      const printer = new IndentPrinter()
      expect(printer).toBeInstanceOf(IndentPrinter)
    })

    test("static print method works", () => {
      const input = "<div>Hello World</div>"
      const parseResult = Herb.parse(input, { track_whitespace: true })
      expect(parseResult.value).toBeTruthy()

      const output = IndentPrinter.print(parseResult.value!)
      expect(output).toBe(input)
    })
  })

  describe("Flat elements", () => {
    test("flat element prints unchanged", () => {
      const input = "<div>Hello</div>"
      expect(printIndented(input)).toBe("<div>Hello</div>")
    })

    test("self-closing element prints unchanged", () => {
      const input = "<br />"
      expect(printIndented(input)).toBe("<br />")
    })
  })

  describe("Nested elements", () => {
    test("nested elements get re-indented based on depth", () => {
      const input = dedent`
        <div>
            <p>
                Hello
            </p>
        </div>
      `

      const expected = dedent`
        <div>
          <p>
            Hello
          </p>
        </div>
      `

      expect(printIndented(input)).toBe(expected)
    })

    test("deeply nested elements", () => {
      const input = dedent`
        <div>
              <ul>
                    <li>
                          Hello
                    </li>
              </ul>
        </div>
      `

      const expected = dedent`
        <div>
          <ul>
            <li>
              Hello
            </li>
          </ul>
        </div>
      `

      expect(printIndented(input)).toBe(expected)
    })
  })

  describe("indentWidth option", () => {
    test("indentWidth of 4 spaces", () => {
      const input = dedent`
        <div>
          <p>
            Hello
          </p>
        </div>
      `

      const expected = dedent`
        <div>
            <p>
                Hello
            </p>
        </div>
      `

      expect(printIndented(input, 4)).toBe(expected)
    })
  })

  describe("Whitespace-only lines", () => {
    test("whitespace-only lines become empty", () => {
      const input = "<div>\n   \n  <p>Hello</p>\n</div>"

      const expected = dedent`
        <div>

          <p>Hello</p>
        </div>
      `

      expect(printIndented(input)).toBe(expected)
    })
  })

  describe("Preserves attributes and tag structure", () => {
    test("preserves attributes", () => {
      const input = dedent`
        <div class="container" id="main">
              <p>Hello</p>
        </div>
      `

      const expected = dedent`
        <div class="container" id="main">
          <p>Hello</p>
        </div>
      `

      expect(printIndented(input)).toBe(expected)
    })
  })

  describe("ERB block structures", () => {
    test("ERB if/else indents each branch", () => {
      const input = dedent`
        <% if true %>
              <p>Yes</p>
        <% else %>
              <p>No</p>
        <% end %>
      `

      const expected = dedent`
        <% if true %>
          <p>Yes</p>
        <% else %>
          <p>No</p>
        <% end %>
      `

      expect(printIndented(input)).toBe(expected)
    })

    test("ERB each block indents body", () => {
      const input = dedent`
        <% items.each do |item| %>
              <p><%= item %></p>
        <% end %>
      `

      const expected = dedent`
        <% items.each do |item| %>
          <p><%= item %></p>
        <% end %>
      `

      expect(printIndented(input)).toBe(expected)
    })

    test("ERB unless indents body", () => {
      const input = dedent`
        <% unless false %>
              <p>Hello</p>
        <% end %>
      `

      const expected = dedent`
        <% unless false %>
          <p>Hello</p>
        <% end %>
      `

      expect(printIndented(input)).toBe(expected)
    })
  })

  describe("Mixed HTML + ERB", () => {
    test("HTML with ERB content inside", () => {
      const input = dedent`
        <div>
              <% if true %>
                    <p>Hello</p>
              <% end %>
        </div>
      `

      const expected = dedent`
        <div>
          <% if true %>
            <p>Hello</p>
          <% end %>
        </div>
      `

      expect(printIndented(input)).toBe(expected)
    })

    test("ERB expression in element", () => {
      const input = dedent`
        <div>
              <%= @name %>
        </div>
      `

      const expected = dedent`
        <div>
          <%= @name %>
        </div>
      `

      expect(printIndented(input)).toBe(expected)
    })
  })
})
