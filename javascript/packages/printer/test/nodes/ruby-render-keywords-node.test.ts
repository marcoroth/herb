import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyRenderKeywordsNode, isERBRenderNode, isRubyRenderKeywordsNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("RubyRenderKeywordsNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints nothing from constructed node", () => {
    const node = RubyRenderKeywordsNode.from({
      type: "AST_RUBY_RENDER_KEYWORDS_NODE",
      location: createLocation(),
      errors: [],
      partial: createToken("TOKEN_IDENTIFIER", "shared/header"),
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

    expectNodeToPrint(node, "")
  })

  test("does not print when rendering partial string", () => {
    expectPrintRoundTrip(`<%= render "shared/header" %>`, true, { render_nodes: true })
  })

  test("does not print when rendering with keyword partial", () => {
    expectPrintRoundTrip(`<%= render partial: "card" %>`, true, { render_nodes: true })
  })

  test("does not print when rendering with collection", () => {
    expectPrintRoundTrip(`<%= render partial: "product", collection: @products %>`, true, { render_nodes: true })
  })

  test("does not print when rendering with layout", () => {
    expectPrintRoundTrip(`<%= render layout: "wrapper" %>`, false, { render_nodes: true })
  })

  test("does not print when rendering component with object", () => {
    expectPrintRoundTrip(`<%= render BlogComponent.new %>`, true, { render_nodes: true })
  })

  test("does not print when rendering with locals", () => {
    expectPrintRoundTrip(`<%= render partial: "card", locals: { title: @title } %>`, true, { render_nodes: true })
  })
})
