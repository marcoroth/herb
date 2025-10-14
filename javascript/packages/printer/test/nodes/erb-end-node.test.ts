import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBEndNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBEndNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBEndNode.from({
      type: "AST_ERB_END_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " end "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
    })

    expectNodeToPrint(node, "<% end %>")
  })
})
