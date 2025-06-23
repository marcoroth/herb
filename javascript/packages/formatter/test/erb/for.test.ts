import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node"
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
        <li>
          <%= item.name %>
        </li>
      <% end %>
    `)
  })
})
