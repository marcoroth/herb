import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { CSSRuleNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation } from "../helpers/printer-test-helpers.js"

describe("CSSRuleNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("CSS rules are not printed independently", () => {
    const node = CSSRuleNode.from({
      type: "AST_CSS_RULE_NODE",
      location: createLocation(),
      errors: [],
      selector: "body",
      declarations: []
    })

    expectNodeToPrint(node, "")
  })

  test("CSS rules are part of style tag content", () => {
    expectPrintRoundTrip(dedent`
      <style>
        body {
          color: red;
        }
      </style>
    `)
  })
})
