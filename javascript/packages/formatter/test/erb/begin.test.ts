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

  test("formats ERB begin/rescue/else/ensure blocks", () => {
    const source = dedent`
      <% begin %>OK<% rescue Error => e %>ERR<% else %>NONE<% ensure %>FIN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% begin %>
        OK
      <% rescue Error => e %>
        ERR
      <% else %>
        NONE
      <% ensure %>
        FIN
      <% end %>
    `)
  })

  test("formats ERB begin with only rescue", () => {
    const input = dedent`
      <% begin %>
      <%= risky_operation %>
      <% rescue StandardError => e %>
      <p>Error: <%= e.message %></p>
      <% end %>
    `

    const expected = dedent`
      <% begin %>
        <%= risky_operation %>
      <% rescue StandardError => e %>
        <p>Error: <%= e.message %></p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB begin with rescue and variables", () => {
    const input = dedent`
      <% begin %>
      <%= dangerous_method %>
      <% rescue => e %>
      <p>Error: <%= e.message %></p>
      <% end %>
    `

    const expected = dedent`
      <% begin %>
        <%= dangerous_method %>
      <% rescue => e %>
        <p>Error: <%= e.message %></p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB begin with ensure only", () => {
    const input = dedent`
      <% begin %>
      <%= some_operation %>
      <% ensure %>
      <%= cleanup_operation %>
      <% end %>
    `

    const expected = dedent`
      <% begin %>
        <%= some_operation %>
      <% ensure %>
        <%= cleanup_operation %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB begin with rescue/else/ensure", () => {
    const input = dedent`
      <% begin %>
      <%= risky_operation %>
      <% rescue StandardError => e %>
      <p>Error occurred: <%= e.message %></p>
      <% else %>
      <p>No errors occurred</p>
      <% ensure %>
      <%= cleanup_operation %>
      <% end %>
    `

    const expected = dedent`
      <% begin %>
        <%= risky_operation %>
      <% rescue StandardError => e %>
        <p>Error occurred: <%= e.message %></p>
      <% else %>
        <p>No errors occurred</p>
      <% ensure %>
        <%= cleanup_operation %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB begin with typed rescue", () => {
    const input = dedent`
      <% begin %>
      <%= dangerous_operation %>
      <% rescue ArgumentError => e %>
      <p>Argument error: <%= e.message %></p>
      <% end %>
    `

    const expected = dedent`
      <% begin %>
        <%= dangerous_operation %>
      <% rescue ArgumentError => e %>
        <p>Argument error: <%= e.message %></p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB begin with rescue and else only", () => {
    const input = dedent`
      <% begin %>
      <%= operation %>
      <% rescue %>
      <p>Something went wrong</p>
      <% else %>
      <p>Everything went well</p>
      <% end %>
    `

    const expected = dedent`
      <% begin %>
        <%= operation %>
      <% rescue %>
        <p>Something went wrong</p>
      <% else %>
        <p>Everything went well</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("begin without surrounding spaces", () => {
    const input = dedent`
      <%begin%>
      <%rescue%>
      <%ensure%>
      <%end%>
    `

    const expected = dedent`
      <% begin %>
      <% rescue %>
      <% ensure %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })
})
