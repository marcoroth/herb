import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBCaseMatchNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken, end_node } from "../helpers/printer-test-helpers.js"

describe("ERBCaseNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBCaseMatchNode.from({
      type: "AST_ERB_CASE_MATCH_NODE",
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
      <% in [Integer] %>
        Integer
      <% else %>
        else
      <% end %>
    `)
  })
})
