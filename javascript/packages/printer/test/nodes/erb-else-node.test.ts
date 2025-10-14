import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBElseNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBElseNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBElseNode.from({
      type: "AST_ERB_ELSE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " else "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: []
    })

    expectNodeToPrint(node, "<% else %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      <% if true %>
        if
      <% else %>
        else
      <% end %>
    `)
  })
})
