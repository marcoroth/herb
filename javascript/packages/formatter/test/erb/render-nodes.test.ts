import { describe, test, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers.js"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter - Render Nodes", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80,
    }, {
      render_nodes: true,
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("render partial string preserves source", () => {
    expectFormattedToMatch(`<%= render "card" %>`)
  })

  test("render with keyword partial preserves source", () => {
    expectFormattedToMatch(`<%= render partial: "card" %>`)
  })

  test("render with locals preserves source", () => {
    expectFormattedToMatch(`<%= render partial: "card", locals: { title: @title } %>`)
  })

  test("render with implicit locals preserves source", () => {
    expectFormattedToMatch(`<%= render "card", title: @title, body: "Hello" %>`)
  })

  test("render with collection preserves source", () => {
    expectFormattedToMatch(`<%= render partial: "product", collection: @products %>`)
  })

  test("render object preserves source", () => {
    expectFormattedToMatch(`<%= render @product %>`)
  })

  test("render inside HTML element", () => {
    expectFormattedToMatch(dedent`
      <div>
        <%= render "card" %>
      </div>
    `)
  })
})
