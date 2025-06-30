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

  test("formats ERB while loops", () => {
    const source = dedent`
      <% while i < 3 %><b><%= i %></b><% i += 1 %><% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% while i < 3 %>
        <b>
          <%= i %>
        </b>
        <% i += 1 %>
      <% end %>
    `)
  })
})
