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

  test("formats ERB case/when/else statements", () => {
    const source = dedent`
      <% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case status %>
      <% when "ok" %>
        GOOD
      <% when "error" %>
        BAD
      <% else %>
        UNKNOWN
      <% end %>
    `)
  })

  test("formats ERB case/when/else statements inside element", () => {
    const source = dedent`
      <div><% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <% case status %>
        <% when "ok" %>
          GOOD
        <% when "error" %>
          BAD
        <% else %>
          UNKNOWN
        <% end %>
      </div>
    `)
  })
})
