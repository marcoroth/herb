import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLVirtualCloseTagNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLVirtualCloseTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node - prints nothing", () => {
    const node = HTMLVirtualCloseTagNode.from({
      type: "AST_HTML_VIRTUAL_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_name: createToken("TOKEN_IDENTIFIER", "div")
    })

    expectNodeToPrint(node, "")
  })

  test("can print from node with null tag_name - prints nothing", () => {
    const node = HTMLVirtualCloseTagNode.from({
      type: "AST_HTML_VIRTUAL_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_name: null
    })

    expectNodeToPrint(node, "")
  })

  test("can print from node for a", () => {
    const node = HTMLVirtualCloseTagNode.from({
      type: "AST_HTML_VIRTUAL_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_name: createToken("TOKEN_IDENTIFIER", "a")
    })

    expectNodeToPrint(node, "")
  })

  test("can print from node for div", () => {
    const node = HTMLVirtualCloseTagNode.from({
      type: "AST_HTML_VIRTUAL_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_name: createToken("TOKEN_IDENTIFIER", "div")
    })

    expectNodeToPrint(node, "")
  })
})
