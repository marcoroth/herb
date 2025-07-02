import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLCommentNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createLiteralNode, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLCommentNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLCommentNode.from({
      type: "AST_HTML_COMMENT_NODE",
      location,
      errors: [],
      comment_start: createToken("TOKEN_HTML_COMMENT_START", "<!--"),
      children: [
        createLiteralNode(" Content ")
      ],
      comment_end: createToken("TOKEN_HTML_COMMENT_END", "-->")
    })

    expectNodeToPrint(node, "<!-- Content -->")
  })

  test("can print from node with multiple children", () => {
    const node = HTMLCommentNode.from({
      type: "AST_HTML_COMMENT_NODE",
      location,
      errors: [],
      comment_start: createToken("TOKEN_HTML_COMMENT_START", "<!--"),
      children: [
        createLiteralNode("One"),
        createLiteralNode(" "),
        createLiteralNode("Two"),
      ],
      comment_end: createToken("TOKEN_HTML_COMMENT_END", "-->")
    })

    expectNodeToPrint(node, "<!--One Two-->")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<!--nospaces-->`)
    expectPrintRoundTrip(`<!-- with spaces -->`)
    expectPrintRoundTrip(`<!--        with       more      spaces         -->`)
    expectPrintRoundTrip(`<!--  -->`)
    expectPrintRoundTrip(`<!--   <%= erb %>   -->`)
    expectPrintRoundTrip(`<!-- before <%= erb %> after -->`)
  })

  test("can print from invalid source", () => {
    expectPrintRoundTrip(`<!--`, false)
    expectPrintRoundTrip(`<!--  `, false)
    expectPrintRoundTrip(`<!--  --!>`, false)
    expectPrintRoundTrip(`<!-- before <%= erb after`, false)
  })
})
