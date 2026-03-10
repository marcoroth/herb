import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLAttributeRubySplatNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLAttributeRubySplatNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLAttributeRubySplatNode.from({
      type: "AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE",
      location: createLocation(),
      errors: [],
      content: "example_content",
      prefix: "example_prefix"
    })

    expectNodeToPrint(node, "TODO: Test not implemented yet for HTMLAttributeRubySplatNode")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      TODO: Add template that produces HTMLAttributeRubySplatNode
    `)
  })
})
