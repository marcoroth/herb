import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { DocumentNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip } from "../helpers/printer-test-helpers.js"

describe("DocumentNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = DocumentNode.from({
      type: "AST_DOCUMENT_NODE",
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
      errors: [],
      children: []
    })

    expectNodeToPrint(node, "")
  })

  test("can print from source", () => {
    expectPrintRoundTrip("")
  })

  test("with element", () => {
    expectPrintRoundTrip(`<div></div>`)
  })

  test("with multiple elements on top-level", () => {
    expectPrintRoundTrip(`<div></div><div></div>`)
  })
})
