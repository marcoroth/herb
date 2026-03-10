import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBInNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken, createTextNode } from "../helpers/printer-test-helpers.js"

describe("ERBInNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBInNode.from({
      type: "AST_ERB_IN_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " in [Integer] "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  Hello")
      ]
    })

    expectNodeToPrint(node, dedent`
      <% in [Integer] %>
        Hello
    `)
  })
})
