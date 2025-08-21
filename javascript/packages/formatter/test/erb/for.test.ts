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

  test("formats ERB for/in loops with nested HTML", () => {
    const source = dedent`
      <% for item in list %><li><%= item.name %></li><% end %>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <% for item in list %>
        <li><%= item.name %></li>
      <% end %>
    `)
  })

  test("formats ERB for loop with multiple iterations", () => {
    const input = dedent`
      <% for user in @users %>
      <div class="user">
      <h3><%= user.name %></h3>
      <p><%= user.email %></p>
      </div>
      <% end %>
    `

    const expected = dedent`
      <% for user in @users %>
        <div class="user">
          <h3><%= user.name %></h3>
          <p><%= user.email %></p>
        </div>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB for loop with array range", () => {
    const input = dedent`
      <% for i in 1..5 %>
      <span>Number <%= i %></span>
      <% end %>
    `

    const expected = dedent`
      <% for i in 1..5 %>
        <span>Number <%= i %></span>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats nested for loops", () => {
    const input = dedent`
      <% for category in categories %>
      <h2><%= category.name %></h2>
      <% for product in category.products %>
      <p><%= product.name %> - $<%= product.price %></p>
      <% end %>
      <% end %>
    `

    const expected = dedent`
      <% for category in categories %>
        <h2><%= category.name %></h2>
        <% for product in category.products %>
          <p><%= product.name %> - $<%= product.price %></p>
        <% end %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("for without surrounding spaces", () => {
    const input = dedent`
      <%for item in items%>
      <%end%>
    `

    const expected = dedent`
      <% for item in items %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })
})
