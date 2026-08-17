import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("formats block with rescue", () => {
    const source = dedent`
      <% 5.times do %>OK<% rescue %>ERR<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% 5.times do %>
        OK
      <% rescue %>
        ERR
      <% end %>
    `)
  })

  test("formats block with rescue and ensure", () => {
    const source = dedent`
      <% 5.times do %>OK<% rescue %>ERR<% ensure %>FIN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% 5.times do %>
        OK
      <% rescue %>
        ERR
      <% ensure %>
        FIN
      <% end %>
    `)
  })

  test("formats block with rescue, else, and ensure", () => {
    const source = dedent`
      <% 5.times do %>OK<% rescue %>ERR<% else %>NONE<% ensure %>FIN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% 5.times do %>
        OK
      <% rescue %>
        ERR
      <% else %>
        NONE
      <% ensure %>
        FIN
      <% end %>
    `)
  })

  test("formats block with typed rescue", () => {
    const input = dedent`
      <% items.each do |item| %>
      <%= item %>
      <% rescue StandardError => e %>
      <p>Error: <%= e.message %></p>
      <% end %>
    `

    const expected = dedent`
      <% items.each do |item| %>
        <%= item %>
      <% rescue StandardError => e %>
        <p>Error: <%= e.message %></p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats block with rescue and else only", () => {
    const input = dedent`
      <% items.each do |item| %>
      <%= item %>
      <% rescue %>
      <p>Error</p>
      <% else %>
      <p>Success</p>
      <% end %>
    `

    const expected = dedent`
      <% items.each do |item| %>
        <%= item %>
      <% rescue %>
        <p>Error</p>
      <% else %>
        <p>Success</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats block with ensure only", () => {
    const input = dedent`
      <% 5.times do %>
      <%= something %>
      <% ensure %>
      <%= cleanup %>
      <% end %>
    `

    const expected = dedent`
      <% 5.times do %>
        <%= something %>
      <% ensure %>
        <%= cleanup %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  describe("content-preserving helper blocks (#1702)", () => {
    test("preserves newlines between JavaScript statements inside javascript_tag do", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("preserves more than two statements", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag do %>
          const a = 1
          const b = 2
          console.log(a + b)
        <% end %>
      `)
    })

    test("preserves content when the helper takes options", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag(type: "module") do %>
          import x from "y"
          x()
        <% end %>
      `)
    })

    test("preserves content when the helper takes a keyword argument", () => {
      expectFormattedToMatch(dedent`
        <%= javascript_tag nonce: true do %>
          const a = 1
          console.log(a)
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

    test("preserves content when nested in an element", () => {
      expectFormattedToMatch(dedent`
        <div>
          <%= javascript_tag do %>
            const a = 1
            console.log(a)
          <% end %>
        </div>
      `)
    })

    test("preserves content in a content_tag :script block", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag :script do %>
          const a = 1
          console.log(a)
        <% end %>
      `)
    })

    test("preserves content in a content_tag :style block", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag :style do %>
          .a { color: red }
          .b { color: blue }
        <% end %>
      `)
    })

    test("preserves content for a quoted or parenthesised tag name", () => {
      expectFormattedToMatch(dedent`
        <%= content_tag("script", type: "module") do %>
          import x from "y"
          x()
        <% end %>
      `)
    })

    test("preserves content for the tag builder", () => {
      expectFormattedToMatch(dedent`
        <%= tag.style do %>
          .a { color: red }
          .b { color: blue }
        <% end %>
      `)
    })

    test("still collapses HTML text in a content_tag :div block", () => {
      const expected = dedent`
        <%= content_tag :div do %>
          Hello world
        <% end %>
      `

      expect(formatter.format(dedent`
        <%= content_tag :div do %>
          Hello
          world
        <% end %>
      `)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("still collapses HTML text in a capture block", () => {
      const expected = dedent`
        <%= capture do %>
          Hello world
        <% end %>
      `

      expect(formatter.format(dedent`
        <%= capture do %>
          Hello
          world
        <% end %>
      `)).toEqual(expected)
      expectFormattedToMatch(expected)
    })
  })
})
