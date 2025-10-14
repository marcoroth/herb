import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLElementNode, HTMLOpenTagNode, HTMLCloseTagNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken, createTextNode } from "../helpers/printer-test-helpers.js"

describe("HTMLElementNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints simple HTML element", () => {
    expectPrintRoundTrip(`<div></div>`)
  })

  test("prints HTML element with content", () => {
    expectPrintRoundTrip(`<p>Hello World</p>`)
  })

  test("prints HTML element with attributes", () => {
    expectPrintRoundTrip(`<div class="container" id="main"></div>`)
  })

  test("prints nested HTML elements", () => {
    expectPrintRoundTrip(dedent`
      <div>
        <h1>Title</h1>
        <p>Paragraph</p>
      </div>
    `)
  })

  test("prints HTML element with ERB content", () => {
    expectPrintRoundTrip(`<h1><%= @title %></h1>`)
  })

  test("prints HTML element with ERB in attributes", () => {
    expectPrintRoundTrip(`<div class="<%= @css_class %>" data-id="<%= @item.id %>">Content</div>`)
  })

  test("can print from node", () => {
    const open_tag = HTMLOpenTagNode.from({
      type: "AST_HTML_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START", "<"),
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">"),
      children: [],
      is_void: true
    })

    const close_tag = HTMLCloseTagNode.from({
      type: "AST_HTML_CLOSE_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_HTML_TAG_START_CLOSE", "</"),
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      tag_closing: createToken("TOKEN_HTML_TAG_END", ">")
    })

    const node = HTMLElementNode.from({
      type: "AST_HTML_ELEMENT_NODE",
      location,
      errors: [],
      open_tag,
      tag_name: createToken("TOKEN_IDENTIFIER", "a"),
      body: [
        createTextNode("Click me")
      ],
      close_tag,
      is_void: false
    })

    expectNodeToPrint(node, "<a>Click me</a>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<h1 id="element" class="attributes">Element</h1>`)
  })
})
