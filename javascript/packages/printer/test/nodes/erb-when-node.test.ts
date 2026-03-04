import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBWhenNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBWhenNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBWhenNode.from({
      type: "AST_ERB_WHEN_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " when String "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: []
    })

    expectNodeToPrint(node, "<% when String %>")
  })
})
