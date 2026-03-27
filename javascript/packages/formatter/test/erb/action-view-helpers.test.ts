import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter - ActionView Helpers", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    }, {
      action_view_helpers: true,
    })
  })

  test("tag.div with multiline data hash preserves original source", () => {
    const source = dedent`
      <%= tag.div(
        data: {
          controller: "hello",
          action: "click->hello#greet"
        }
      ) do %>
        <div>Hello</div>
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("tag.div with simple attributes preserves original source", () => {
    const source = dedent`
      <%= tag.div class: "content" do %>
        Content
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("tag.div without block preserves original source", () => {
    const source = `<%= tag.div class: "content" %>`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("content_tag with attributes preserves original source", () => {
    const source = dedent`
      <%= content_tag :div, class: "content" do %>
        Content
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("tag.div with data and aria splats preserves original source", () => {
    const source = dedent`
      <%= tag.div(
        data: { controller: "hello", **data_attrs },
        aria: { label: "greeting", **aria_attrs }
      ) do %>
        <div>Hello</div>
      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })
})
