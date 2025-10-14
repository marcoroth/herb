import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBUnlessNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, end_node, createToken, createTextNode } from "../helpers/printer-test-helpers.js"

describe("ERBUnlessNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBUnlessNode.from({
      type: "AST_ERB_UNLESS_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " unless condition? "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("Content")
      ],
      else_clause: null,
      end_node
    })

    expectNodeToPrint(node, "<% unless condition? %>Content<% end %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% unless condition? %>Content<% end %>`)

    expectPrintRoundTrip(dedent`
      <% unless condition? %>
        Content
        <% end %>
    `)
  })

  test("can print from invlid source", () => {
    expectPrintRoundTrip(`<% unless condition? %>`, false)

    expectPrintRoundTrip(dedent`
      <% unless condition? %>
        Content
    `, false)
  })
})
