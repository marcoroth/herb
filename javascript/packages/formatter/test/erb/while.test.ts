import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("formats ERB while loops", () => {
    const source = dedent`
      <% while i < 3 %><b><%= i %></b><% i += 1 %><% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% while i < 3 %>
        <b><%= i %></b>
        <% i += 1 %>
      <% end %>
    `)
  })

  test("formats ERB while with complex condition", () => {
    const input = dedent`
      <% while user.active? && user.posts.count < 10 %>
      <p>Processing <%= user.name %></p>
      <% user.process_next_post %>
      <% end %>
    `

    const expected = dedent`
      <% while user.active? && user.posts.count < 10 %>
        <p>Processing <%= user.name %></p>
        <% user.process_next_post %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats nested while loops", () => {
    const input = dedent`
      <% while i < 3 %>
      <div>Outer: <%= i %></div>
      <% j = 0 %>
      <% while j < 2 %>
      <span>Inner: <%= j %></span>
      <% j += 1 %>
      <% end %>
      <% i += 1 %>
      <% end %>
    `

    const expected = dedent`
      <% while i < 3 %>
        <div>Outer: <%= i %></div>
        <% j = 0 %>
        <% while j < 2 %>
          <span>Inner: <%= j %></span>
          <% j += 1 %>
        <% end %>
        <% i += 1 %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("while without surrounding spaces", () => {
    const input = dedent`
      <%while condition%>
      <%end%>
    `

    const expected = dedent`
      <% while condition %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })
})
