import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBRenderNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBRenderNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBRenderNode.from({
      type: "AST_ERB_RENDER_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", ' render "card" '),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
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
})
