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

  test("render with do...end block and arguments", () => {
    expectFormattedToMatch(dedent`
      <%= render BlogComponent.new do |component| %>
        <% component.with_header %>
      <% end %>
    `)
  })

  test("render with do...end block without arguments", () => {
    expectFormattedToMatch(dedent`
      <%= render LayoutComponent.new do %>
        <p>content</p>
      <% end %>
    `)
  })

  test("render with do...end block containing nested HTML", () => {
    expectFormattedToMatch(dedent`
      <%= render CardComponent.new do |card| %>
        <div class="header">
          <h1>Title</h1>
        </div>
      <% end %>
    `)
  })

  test("render with inline brace block and arguments", () => {
    expectFormattedToMatch(`<%= render AbcComponent.new { |component| component.with_header } %>`)
  })

  test("render with inline brace block without arguments", () => {
    expectFormattedToMatch(`<%= render AbcComponent.new { "something" } %>`)
  })

  test("render with constructor arguments and inline brace block", () => {
    expectFormattedToMatch(`<%= render AbcComponent.new(some_args: :here, that_are_being: "passed") { |component| component.with_header } %>`)
  })

  test("render with partial string and do...end block", () => {
    expectFormattedToMatch(dedent`
      <%= render "shared/card" do %>
        <p>card content</p>
      <% end %>
    `)
  })

  test("render with do...end block inside HTML element", () => {
    expectFormattedToMatch(dedent`
      <div>
        <%= render BlogComponent.new do |component| %>
          <% component.with_header %>
        <% end %>
      </div>
    `)
  })
})
