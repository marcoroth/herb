import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLDoctypeNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken, createLiteralNode } from "../helpers/printer-test-helpers.js"

describe("HTMLDoctypeNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLDoctypeNode.from({
      type: "AST_HTML_DOCTYPE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_DOCTYPE", "<!DOCTYPE"),
      children: [],
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">")
    })

    expectNodeToPrint(node, "<!DOCTYPE>")
  })

  test("can print from node with child", () => {
    const node = HTMLDoctypeNode.from({
      type: "AST_HTML_DOCTYPE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_DOCTYPE", "<!doctype"),
      children: [
        createLiteralNode(" html5")
      ],
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">")
    })

    expectNodeToPrint(node, "<!doctype html5>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<!DOCTYPE>`)
    expectPrintRoundTrip(`<!DOCTYPE >`)
    expectPrintRoundTrip(`<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">`)
    expectPrintRoundTrip(`<!doctype>`)
    expectPrintRoundTrip(`<!DoCtYpE>`)
    expectPrintRoundTrip(`<!dOcTyPe>`)
    expectPrintRoundTrip(`<!doctype html5>`)
    expectPrintRoundTrip(`<!DoCTyPe <% hello %> hello>`)
    expectPrintRoundTrip(`<!DoCTyPe hello <%= hello %> hello>`)
  })
})
