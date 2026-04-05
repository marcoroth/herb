import { describe, test, beforeAll } from "vitest"
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { ERBRenderNode, RubyRenderKeywordsNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBRenderNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const keywords = RubyRenderKeywordsNode.from({
      type: "AST_RUBY_RENDER_KEYWORDS_NODE",
      location: createLocation(),
      errors: [],
      partial: null,
      template_path: null,
      layout: null,
      file: null,
      inline_template: null,
      body: null,
      plain: null,
      html: null,
      renderable: null,
      collection: null,
      object: null,
      as_name: null,
      spacer_template: null,
      formats: null,
      variants: null,
      handlers: null,
      content_type: null,
      locals: []
    })

    const node = ERBRenderNode.from({
      type: "AST_ERB_RENDER_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", ' render "card" '),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      keywords: keywords,
      body: [],
      block_arguments: [],
      rescue_clause: null,
      else_clause: null,
      ensure_clause: null,
      end_node: null
    })

    expectNodeToPrint(node, '<%= render "card" %>')
  })

  test("render with partial string", () => {
    expectPrintRoundTrip(`<%= render "card" %>`, true, { render_nodes: true })
  })

  test("render with partial keyword", () => {
    expectPrintRoundTrip(`<%= render partial: "card" %>`, true, { render_nodes: true })
  })

  test("render with locals", () => {
    expectPrintRoundTrip(`<%= render partial: "card", locals: { title: @title } %>`, true, { render_nodes: true })
  })

  test("render with implicit locals", () => {
    expectPrintRoundTrip(`<%= render "card", title: @title, body: "Hello" %>`, true, { render_nodes: true })
  })

  test("render with collection", () => {
    expectPrintRoundTrip(`<%= render partial: "product", collection: @products %>`, true, { render_nodes: true })
  })

  test("render with collection and as", () => {
    expectPrintRoundTrip(`<%= render partial: "product", collection: @products, as: :item %>`, true, { render_nodes: true })
  })

  test("render with object", () => {
    expectPrintRoundTrip(`<%= render @product %>`, true, { render_nodes: true })
  })

  test("render with layout", () => {
    expectPrintRoundTrip(`<%= render layout: "wrapper" %>`, false, { render_nodes: true })
  })

  test("render with template", () => {
    expectPrintRoundTrip(`<%= render template: "posts/show" %>`, true, { render_nodes: true })
  })

  test("render inside HTML", () => {
    expectPrintRoundTrip(`<div><%= render "card" %></div>`, true, { render_nodes: true })
  })

  test("render with do...end block and arguments", () => {
    expectPrintRoundTrip(dedent`
      <%= render BlogComponent.new do |component| %>
        <% component.with_header %>
      <% end %>
    `, true, { render_nodes: true })
  })

  test("render with do...end block without arguments", () => {
    expectPrintRoundTrip(dedent`
      <%= render LayoutComponent.new do %>
        <p>content</p>
      <% end %>
    `, true, { render_nodes: true })
  })

  test("render with inline brace block and arguments", () => {
    expectPrintRoundTrip(`<%= render AbcComponent.new { |component| component.with_header } %>`, true, { render_nodes: true })
  })

  test("render with inline brace block without arguments", () => {
    expectPrintRoundTrip(`<%= render AbcComponent.new { "something" } %>`, true, { render_nodes: true })
  })

  test("render with constructor arguments and inline brace block", () => {
    expectPrintRoundTrip(`<%= render AbcComponent.new(some_args: :here) { |component| component.with_header } %>`, true, { render_nodes: true })
  })

  test("render with partial string and do...end block", () => {
    expectPrintRoundTrip(dedent`
      <%= render "shared/card" do %>
        <p>card content</p>
      <% end %>
    `, true, { render_nodes: true })
  })
})
