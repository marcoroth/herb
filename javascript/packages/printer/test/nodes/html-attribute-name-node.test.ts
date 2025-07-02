import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLAttributeNameNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLAttributeNameNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLAttributeNameNode.from({
      type: "AST_HTML_ATTRIBUTE_NAME_NODE",
      location,
      errors: [],
      name: createToken("TOKEN_IDENTIFIER", "class")
    })

    expectNodeToPrint(node, "class")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`<div id="id"></div>`)
    expectPrintRoundTrip(dedent`<div id="<%= dom_id(post) %>"></div>`)
    expectPrintRoundTrip(dedent`<div id="<%= dom_id(post) %>" class="classes"></div>`)
  })
})
