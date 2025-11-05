import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { CSSDeclarationNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation } from "../helpers/printer-test-helpers.js"

describe("CSSDeclarationNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("CSS declarations are not printed independently", () => {
    const node = CSSDeclarationNode.from({
      type: "AST_CSS_DECLARATION_NODE",
      location: createLocation(),
      errors: [],
      property: "color",
      value: "red"
    })

    expectNodeToPrint(node, "")
  })

  test("CSS declarations are part of style tag content", () => {
    expectPrintRoundTrip(dedent`
      <style>
        body {
          color: red;
          background: white;
        }
      </style>
    `)
  })
})
