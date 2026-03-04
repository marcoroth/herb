import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { WhitespaceNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("WhitespaceNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = WhitespaceNode.from({
      type: "AST_WHITESPACE_NODE",
      location,
      errors: [],
      value: createToken("TOKEN_WHITESPACE", "")
    })

    expectNodeToPrint(node, "")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(` `)
    expectPrintRoundTrip(`  `)
  })
})
