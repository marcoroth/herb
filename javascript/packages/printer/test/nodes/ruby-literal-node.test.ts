import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyLiteralNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("RubyLiteralNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = RubyLiteralNode.from({
      type: "AST_RUBY_LITERAL_NODE",
      location: createLocation(),
      errors: [],
      content: "example_content"
    })

    expectNodeToPrint(node, "TODO: Test not implemented yet for RubyLiteralNode")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      TODO: Add template that produces RubyLiteralNode
    `)
  })
})
