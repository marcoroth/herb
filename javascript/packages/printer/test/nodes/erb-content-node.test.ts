import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBContentNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBContentNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBContentNode.from({
      type: "AST_ERB_CONTENT_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " content "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      parsed: false,
      valid: false
    })

    expectNodeToPrint(node, "<% content %>")
  })

  test("can print from output node", () => {
    const node = ERBContentNode.from({
      type: "AST_ERB_CONTENT_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", " content "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      parsed: false,
      valid: false
    })

    expectNodeToPrint(node, "<%= content %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% content %>`)
    expectPrintRoundTrip(`<%= content %>`)
    expectPrintRoundTrip(`<%=    content        %>`)
    expectPrintRoundTrip(dedent`
      <%=
        "
          multi-line
          content
          should
          work too
        "
      %>
    `)
  })
})
