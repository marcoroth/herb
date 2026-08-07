import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBForNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, end_node, createToken, createTextNode, createERBContentNode } from "../helpers/printer-test-helpers.js"

describe("ERBForNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBForNode.build({
      location,
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " for i in 1..5 "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  "),
        createERBContentNode(" i ", "<%="),
        createTextNode("\n"),
      ],
      end_node
    })

    expectNodeToPrint(node, dedent`
      <% for i in 1..5 %>
        <%= i %>
      <% end %>
    `)
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      <% for i in 1..5 %>
        <%= i %>
      <% end %>
    `)
  })
})
