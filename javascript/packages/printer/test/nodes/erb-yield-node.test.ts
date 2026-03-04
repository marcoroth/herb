import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBYieldNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBYieldNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBYieldNode.from({
      type: "AST_ERB_YIELD_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", " yield "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
    })

    expectNodeToPrint(node, "<%= yield %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% yield %>`)
    expectPrintRoundTrip(`<%= yield %>`)
    expectPrintRoundTrip(`<%=   yield    %>`)
    expectPrintRoundTrip(`<%= yield :content %>`)
    expectPrintRoundTrip(`<%= yield :content if condition? %>`)
  })
})
