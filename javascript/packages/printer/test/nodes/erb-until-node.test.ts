import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBUntilNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, end_node, createToken, createTextNode } from "../helpers/printer-test-helpers.js"

describe("ERBUntilNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBUntilNode.from({
      type: "AST_ERB_UNTIL_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " until true "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  Hello\n")
      ],
      end_node
    })

    expectNodeToPrint(node, dedent`
      <% until true %>
        Hello
      <% end %>
    `)
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      TODO: Add template that produces ERBUntilNode
    `)
  })
})
