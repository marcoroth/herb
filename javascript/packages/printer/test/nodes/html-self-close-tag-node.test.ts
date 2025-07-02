import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLSelfCloseTagNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLSelfCloseTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLSelfCloseTagNode.from({
      type: "AST_HTML_SELF_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "input"),
      attributes: [],
      tag_closing: createToken("TOKEN_HTML_TAG_SELF_CLOSE", "/>"),
      is_void: false
    })

    expectNodeToPrint(node, "<input/>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<input>`)
    expectPrintRoundTrip(`<input id="id"/>`)
    expectPrintRoundTrip(`<input id="id" class="class"/>`)
  })

  test.todo("preserve whitespace", () => {
    expectPrintRoundTrip(`<input />`)
    expectPrintRoundTrip(`<input id="id" />`)
    expectPrintRoundTrip(`<input id="id" class="class" />`)
  })
})
