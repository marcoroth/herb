import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyBlockParameterNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("RubyBlockParameterNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints nothing from constructed node", () => {
    const node = RubyBlockParameterNode.from({
      type: "AST_RUBY_BLOCK_PARAMETER_NODE",
      location: createLocation(),
      errors: [],
      name: createToken("TOKEN_IDENTIFIER", "component")
    })

    expectNodeToPrint(node, "")
  })

  test("does not print when rendering with do...end block arguments", () => {
    expectPrintRoundTrip(`<%= render BlogComponent.new do |component| %>\n<% end %>`, true, { render_nodes: true })
  })

  test("does not print when rendering with inline brace block arguments", () => {
    expectPrintRoundTrip(`<%= render AbcComponent.new { |component| component.with_header } %>`, true, { render_nodes: true })
  })

  test("does not print when rendering with multiple block arguments", () => {
    expectPrintRoundTrip(`<%= render TableComponent.new do |table, index| %>\n<% end %>`, true, { render_nodes: true })
  })

  test("does not print when rendering do...end block without arguments", () => {
    expectPrintRoundTrip(`<%= render LayoutComponent.new do %>\n<% end %>`, true, { render_nodes: true })
  })

  test("does not print when rendering without block", () => {
    expectPrintRoundTrip(`<%= render "shared/header" %>`, true, { render_nodes: true })
  })
})
