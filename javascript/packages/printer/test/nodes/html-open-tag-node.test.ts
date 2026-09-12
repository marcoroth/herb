import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLOpenTagNode, HTMLAttributeNode, HTMLAttributeNameNode, HTMLAttributeValueNode, WhitespaceNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createLocation, createToken, createLiteralNode } from "../helpers/printer-test-helpers.js"

describe("HTMLOpenTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node with void=false", () => {
    const node = HTMLOpenTagNode.build({
      location,
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">"),
      children: [],
      is_void: false
    })

    expectNodeToPrint(node, "<a>")
  })

  test("can print from node with void=true", () => {
    const node = HTMLOpenTagNode.build({
      location,
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

  test("with ERB node inside tag", () => {
    expectPrintRoundTrip(`<a id="id" <%= content %> class="class">Content</a>`)
  })

  test("preserve whitespace", () => {
    expectPrintRoundTrip(`<a   id="id"  >Content</a>`)
    expectPrintRoundTrip(`<a id="id"        <%= content %>        class="class">Content</a>`)
  })

  test("does not double the space of a WhitespaceNode child that precedes an attribute located elsewhere in the source", () => {
    const attributeName = HTMLAttributeNameNode.build({
      location: createLocation(1, 20),
      children: [
        createLiteralNode("class")
      ]
    })

    const attributeValue = HTMLAttributeValueNode.build({
      location: createLocation(1, 26),
      open_quote: createToken("TOKEN_QUOTE", `"`),
      close_quote: createToken("TOKEN_QUOTE", `"`),
      children: [
        createLiteralNode("content")
      ],
      quoted: true
    })

    const attribute = HTMLAttributeNode.build({
      location: createLocation(1, 20),
      name: attributeName,
      equals: createToken("TOKEN_EQUALS", "="),
      value: attributeValue
    })

    const whitespace = WhitespaceNode.build({
      location,
      value: createToken("TOKEN_WHITESPACE", " ")
    })

    const node = HTMLOpenTagNode.build({
      location,
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">"),
      children: [whitespace, attribute],
      is_void: false
    })

    expectNodeToPrint(node, `<div class="content">`)
  })

  describe("without track_whitespace", () => {
    const untracked = { track_whitespace: false }

    test("keeps the tag name and the attributes apart", () => {
      expectPrintRoundTrip(`<span class="x">Content</span>`, true, untracked)
      expectPrintRoundTrip(`<span class="x" id="y">Content</span>`, true, untracked)
      expectPrintRoundTrip(`<input type="text" disabled>`, true, untracked)
      expectPrintRoundTrip(`<div <%= attributes %>>Content</div>`, true, untracked)
    })

    test("recovers the separating whitespace from the source", () => {
      expectPrintRoundTrip(`<span   class="x">Content</span>`, true, untracked)
      expectPrintRoundTrip(`<span class="x"    id="y">Content</span>`, true, untracked)
      expectPrintRoundTrip(`<span\tclass="x">Content</span>`, true, untracked)
      expectPrintRoundTrip(`<a id="id"        <%= content %>        class="class">Content</a>`, true, untracked)
    })

    test("recovers whitespace that wraps the attributes across lines", () => {
      expectPrintRoundTrip(`<span\n  class="x"\n  id="y">Content</span>`, true, untracked)
    })
  })
})
