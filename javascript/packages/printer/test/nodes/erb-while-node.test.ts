import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBWhileNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createTextNode, createToken, end_node } from "../helpers/printer-test-helpers.js"

describe("ERBWhileNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBWhileNode.from({
      type: "AST_ERB_WHILE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " while true "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("Inside")
      ],
      end_node
    })

    expectNodeToPrint(node, "<% while true %>Inside<% end %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% while true %>Inside<% end %>`)

    expectPrintRoundTrip(dedent`
      <% while true %>
        <%= something %>
      <% end %>
    `)
  })

  test("can print from invlid source", () => {
    expectPrintRoundTrip(`<% while true %>Inside`, false)

    expectPrintRoundTrip(dedent`
      <% while true %>
        <%= something %>
    `, false)
  })
})
