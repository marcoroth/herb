import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyParameterNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("RubyParameterNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints nothing from constructed node", () => {
    const node = RubyParameterNode.from({
      type: "AST_RUBY_PARAMETER_NODE",
      location: createLocation(),
      errors: [],
      name: createToken("TOKEN_IDENTIFIER", "user"),
      default_value: null,
      required: true,
      keyword: false,
      splat: false,
      double_splat: false,
      block: false
    })

    expectNodeToPrint(node, "")
  })

  test("does not print when used as strict local", () => {
    expectPrintRoundTrip(dedent`
      <%# locals: (user:) %>
    `, true, { strict_locals: true })
  })

  test("does not print when used as block argument", () => {
    expectPrintRoundTrip(`<%= render BlogComponent.new do |component| %>\n<% end %>`, true, { render_nodes: true })
  })

  test("does not print when used as inline brace block argument", () => {
    expectPrintRoundTrip(`<%= render AbcComponent.new { |component| component.with_header } %>`, true, { render_nodes: true })
  })

  test("does not print with multiple block arguments", () => {
    expectPrintRoundTrip(`<%= render TableComponent.new do |table, index| %>\n<% end %>`, true, { render_nodes: true })
  })

  test("does not print when block has no arguments", () => {
    expectPrintRoundTrip(`<%= render LayoutComponent.new do %>\n<% end %>`, true, { render_nodes: true })
  })

  test("does not print on regular ERB block", () => {
    expectPrintRoundTrip(`<% items.each do |item| %>\n  <%= item %>\n<% end %>`)
  })
})
