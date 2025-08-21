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

  test("formats ERB until loops", () => {
    const source = dedent`
      <% until i == 3 %><b><%= i %></b><% i += 1 %><% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% until i == 3 %>
        <b><%= i %></b>
        <% i += 1 %>
      <% end %>
    `)
  })

  test("formats ERB until with complex condition", () => {
    const input = dedent`
      <% until queue.empty? || max_attempts_reached? %>
      <p>Processing item: <%= queue.peek.name %></p>
      <% process_queue_item %>
      <% end %>
    `

    const expected = dedent`
      <% until queue.empty? || max_attempts_reached? %>
        <p>Processing item: <%= queue.peek.name %></p>
        <% process_queue_item %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats nested until loops", () => {
    const input = dedent`
      <% until outer_condition_met? %>
      <div>Outer loop iteration</div>
      <% until inner_condition_met? %>
      <span>Inner loop iteration</span>
      <% inner_increment %>
      <% end %>
      <% outer_increment %>
      <% end %>
    `

    const expected = dedent`
      <% until outer_condition_met? %>
        <div>Outer loop iteration</div>
        <% until inner_condition_met? %>
          <span>Inner loop iteration</span>
          <% inner_increment %>
        <% end %>
        <% outer_increment %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("until without surrounding spaces", () => {
    const input = dedent`
      <%until condition%>
      <%end%>
    `

    const expected = dedent`
      <% until condition %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })
})
