import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyStrictLocalNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("RubyStrictLocalNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = RubyStrictLocalNode.from({
      type: "AST_RUBY_STRICT_LOCAL_NODE",
      location: createLocation(),
      errors: [],
      name: createToken(),
      default_value: null,
      required: false,
      double_splat: false
    })

    expectNodeToPrint(node, "")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      <%# locals: (user:) %>
    `, true, { strict_locals: true })
  })
})
