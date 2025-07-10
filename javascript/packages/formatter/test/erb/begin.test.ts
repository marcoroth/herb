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
})
