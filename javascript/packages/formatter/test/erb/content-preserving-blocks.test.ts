import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("content-preserving ERB blocks (#1702)", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  describe("javascript_tag", () => {
    test("preserves newlines between statements", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("preserves blank lines between statements", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const a = 1

          console.log(a)
        <% end %>
      `)
    })

    test("preserves relative indentation", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          function outer() {
            if (x) {
              inner()
            }
          }
        <% end %>
      `)
    })

    test("preserves content that would otherwise be wrapped at maxLineLength", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const message = "a very long string literal that comfortably exceeds the eighty column limit"
        <% end %>
      `)
    })

    test("preserves interpolated ERB inside the block", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          var x = <%= value %>;
          console.log(x)
        <% end %>
      `)
    })

    test("preserves content with a trailing semicolon-free ASI hazard", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const a = 1
          (function () { run() })()
        <% end %>
      `)
    })

    test("handles an empty block", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
        <% end %>
      `)
    })

    test("preserves content when nested inside elements", () => {
      expectFormattedToMatch(dedent`
        <div>
          <section>
            <%= javascript_tag do %>
              const a = 1
              console.log(a)
            <% end %>
          </section>
        </div>
      `)
    })

    test("preserves content for each of several sibling blocks", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const a = 1
          use(a)
        <% end %>

        <%= javascript_tag do %>
          const b = 2
          use(b)
        <% end %>
      `)
    })

    test("preserves non-ASCII content untouched", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const label = "café – naïve"
          console.log(label)
        <% end %>
      `)
    })
  })

  describe("tag name from an argument", () => {
    test("content_tag with a symbol", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag :script do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("content_tag with a double-quoted string", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag "style" do %>
          .a { color: red }
          .b { color: blue }
        <% end %>
      `)
    })

    test("content_tag with a single-quoted string", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag 'script' do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("content_tag with parentheses and options", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag(:script, type: "module") do %>
          import x from "y"
          x()
        <% end %>
      `)
    })

    test("content_tag :pre", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag :pre do %>
          line one
            line two indented
        <% end %>
      `)
    })

    test("content_tag :textarea", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag :textarea do %>
          first line
          second line
        <% end %>
      `)
    })

    test("content_tag with an uppercase tag name", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag :SCRIPT do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("tag builder", () => {
      expectFormattedToMatch(dedent`
        <%= tag.script do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("tag builder with attributes", () => {
      expectFormattedToMatch(dedent`
        <%= tag.style media: "print" do %>
          .a { color: red }
          .b { color: blue }
        <% end %>
      `)
    })
  })

  describe("blocks that hold HTML are still collapsed", () => {
    const collapses = (source: string, expected: string) => {
      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    }

    test("capture", () => {
      collapses(
        dedent`
          <%= capture do %>
            Hello
            world
          <% end %>
        `,
        dedent`
          <%= capture do %>
            Hello world
          <% end %>
        `
      )
    })

    test("content_tag :div", () => {
      collapses(
        dedent`
          <%= content_tag :div do %>
            Hello
            world
          <% end %>
        `,
        dedent`
          <%= content_tag :div do %>
            Hello world
          <% end %>
        `
      )
    })

    test("tag.div", () => {
      collapses(
        dedent`
          <%= tag.div do %>
            Hello
            world
          <% end %>
        `,
        dedent`
          <%= tag.div do %>
            Hello world
          <% end %>
        `
      )
    })

    test("each", () => {
      collapses(
        dedent`
          <% items.each do |item| %>
            Hello
            world
          <% end %>
        `,
        dedent`
          <% items.each do |item| %>
            Hello world
          <% end %>
        `
      )
    })
  })

  describe("not claimed when the emitted tag is unknown", () => {
    test("receiver call", () => {
      expectFormattedToMatch(dedent`
        <%= helpers.javascript_tag do %>
          Hello world
        <% end %>
      `)
    })

    test("safe navigation receiver", () => {
      expectFormattedToMatch(dedent`
        <%= obj&.javascript_tag do %>
          Hello world
        <% end %>
      `)
    })

    test("a near-miss helper name", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag_wrapper do %>
          Hello world
        <% end %>
      `)
    })

    test("content_tag with a variable tag name", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag tag_name do %>
          Hello world
        <% end %>
      `)
    })
  })

  describe("resolution is robust", () => {
    test("a leading Ruby comment before the call", () => {
      expectFormattedToMatch(dedent`
        <%= # which tag?
          javascript_tag do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("a block parameter on the helper", () => {
      const source = dedent`
        <%= javascript_tag do |x| %>
          const a = 1
          console.log(a)
        <% end %>
      `

      expect(() => formatter.format(source)).not.toThrow()
    })

    test("trim markers on the tags", () => {
      const source = dedent`
        <%= javascript_tag do -%>
          const a = 1
          console.log(a)
        <% end -%>
      `

      expect(() => formatter.format(source)).not.toThrow()
      expect(formatter.format(source)).toContain("const a = 1\n")
    })

    test("a `<%` sequence inside the block header does not break resolution", () => {
      const source = dedent`
        <%= javascript_tag class: "a<%b" do %>
          const a = 1
          console.log(a)
        <% end %>
      `

      expect(() => formatter.format(source)).not.toThrow()
    })

    test("formatting the same source twice is stable", () => {
      const source = dedent`
        <%= javascript_tag do %>
          const a = 1
          console.log(a)
        <% end %>

        <%= content_tag :style do %>
          .a { color: red }
        <% end %>
      `

      const once = formatter.format(source)

      expect(formatter.format(once)).toEqual(once)
      expect(once).toEqual(source)
    })

    test("a single formatter instance handles mixed documents in sequence", () => {
      const preserved = dedent`
        <%= javascript_tag do %>
          const a = 1
          console.log(a)
        <% end %>
      `

      const collapsed = dedent`
        <%= content_tag :div do %>
          Hello world
        <% end %>
      `

      expect(formatter.format(preserved)).toEqual(preserved)
      expect(formatter.format(collapsed)).toEqual(collapsed)
      expect(formatter.format(preserved)).toEqual(preserved)
    })
  })
})
