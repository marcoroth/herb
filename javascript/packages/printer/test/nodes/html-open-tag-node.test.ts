import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLOpenTagNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("HTMLOpenTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node with void=false", () => {
    const node = HTMLOpenTagNode.from({
      type: "AST_HTML_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">"),
      children: [],
      is_void: false
    })

    expectNodeToPrint(node, "<a>")
  })

  test("can print from node with void=true", () => {
    const node = HTMLOpenTagNode.from({
      type: "AST_HTML_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", "/>"),
      children: [],
      is_void: true
    })

    expectNodeToPrint(node, "<a/>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<a/>`)
    expectPrintRoundTrip(`<a></a>`)
    expectPrintRoundTrip(`<a id="id"></a>`)
    expectPrintRoundTrip(`<a id="id" class="class"></a>`)
  })

  test.todo("with ERB node inside tag", () => {
    expectPrintRoundTrip(`<a id="id" <%= content %> class="class">Content</a>`)
  })

  test.todo("preserve whitespace", () => {
    expectPrintRoundTrip(`<a   id="id"  >Content</a>`)
    expectPrintRoundTrip(`<a id="id"        <%= content %>        class="class">Content</a>`)
  })
})
