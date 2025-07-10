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

  test("formats simple HTML with ERB content", () => {
    const source = '<div><%= "Hello" %></div>'
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <%= "Hello" %>
      </div>
    `)
  })

  test("formats standalone ERB", () => {
    const source = '<% title %>'
    const result = formatter.format(source)
    expect(result).toEqual(`<% title %>`)
  })

  test("formats nested blocks with final example", () => {
    const source = `
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %><span>OK</span><% else %><span>NO</span><% end %>
        <% end %>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %>
            <span>
              OK
            </span>
          <% else %>
            <span>
              NO
            </span>
          <% end %>
        <% end %>
      </div>
    `)
  })
})
