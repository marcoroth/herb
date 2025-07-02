import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBRescueNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBRescueNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBRescueNode.from({
      type: "AST_ERB_RESCUE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " rescue StandardError => e "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [],
      subsequent: null
    })

    expectNodeToPrint(node, "<% rescue StandardError => e %>")
  })

  test("can print from invalid source", () => {
    expectPrintRoundTrip(dedent`
      TODO: Add template that produces ERBRescueNode
    `)
  })
})
