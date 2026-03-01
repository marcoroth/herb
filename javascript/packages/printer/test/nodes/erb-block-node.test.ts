import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBBlockNode } from "@herb-tools/core"

import {
  expectNodeToPrint,
  expectPrintRoundTrip,
  location,
  createToken,
  createTextNode,
  end_node
} from "../helpers/printer-test-helpers.js"

describe("ERBBlockNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBBlockNode.from({
      type: "AST_ERB_BLOCK_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " something do "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      body: [createTextNode("Content")],
      end_node
    })

    expectNodeToPrint(node, "<% something do %>Content<% end %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% something do %>Content<% end %>`)
  })
})
