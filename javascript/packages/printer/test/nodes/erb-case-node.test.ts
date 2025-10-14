import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBCaseNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken, end_node } from "../helpers/printer-test-helpers.js"

describe("ERBCaseNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBCaseNode.from({
      type: "AST_ERB_CASE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " case variable "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      children: [],
      conditions: [],
      else_clause: null,
      end_node: end_node
    })

    expectNodeToPrint(node, "<% case variable %><% end %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      <% case variable %>
        in-between
      <% when String %>
        String
      <% when Integer %>
        Integer
      <% else %>
        else
      <% end %>
    `)
  })

  test("can print from invalid source", () => {
    expectPrintRoundTrip(dedent`
      <% case variable %>
      <% else %>
        in-between
      <% when String %>
        String
      <% when Integer %>
        Integer
      <% end %>
    `, false)
  })
})
