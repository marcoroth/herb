import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBOpenTagNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBOpenTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBOpenTagNode.from({
      type: "AST_ERB_OPEN_TAG_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken(),
      content: createToken(),
      tag_closing: createToken(),
      tag_name: createToken(),
      children: []
    })

    expectNodeToPrint(node, "TODO: Test not implemented yet for ERBOpenTagNode")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      TODO: Add template that produces ERBOpenTagNode
    `)
  })
})
