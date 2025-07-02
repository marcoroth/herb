import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLCloseTagNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLCloseTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLCloseTagNode.from({
      type: "AST_HTML_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START_CLOSE", "</"),
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">")
    })

    expectNodeToPrint(node, "</a>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`<a></a>`)
    expectPrintRoundTrip(dedent`<custom-name></custom-name>`)
  })

  test("can print from invalid source", () => {
    expectPrintRoundTrip(dedent`</a>`, false)
    expectPrintRoundTrip(dedent`</custom-name>`, false)
  })
})
