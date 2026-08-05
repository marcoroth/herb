import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBStrictLocalsNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBStrictLocalsNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBStrictLocalsNode.from({
      type: "AST_ERB_STRICT_LOCALS_NODE",
      location: createLocation(),
      errors: [],
      tag_opening: createToken(),
      content: createToken(),
      tag_closing: createToken(),
      analyzed_ruby: null,
      prism_node: null,
      locals: []
    })

    expectNodeToPrint(node, "")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      <%# locals: (user:, theme: "light") %>
    `, true, { strict_locals: true })
  })
})
