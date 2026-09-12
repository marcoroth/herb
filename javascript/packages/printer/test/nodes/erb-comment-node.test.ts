import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBCommentNode, isERBCommentNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBCommentNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBCommentNode.build({
      location,
      tag_opening: createToken("TOKEN_ERB_START", "<%#"),
      content: createToken("TOKEN_ERB_CONTENT", " a comment "),
      tag_closing: createToken("TOKEN_ERB_END", "%>")
    })

    expectNodeToPrint(node, "<%# a comment %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<%# a comment %>`)
    expectPrintRoundTrip(`<%#a comment%>`)
    expectPrintRoundTrip(`<%#= a commented out output tag %>`)
    expectPrintRoundTrip(`<%#- a comment -%>`)
    expectPrintRoundTrip(dedent`
      <%#
        a comment
        over several lines
      %>
    `)
  })

  test("keeps a comment that sits inside an attribute value", () => {
    expectPrintRoundTrip(`<div class="<%= a %><%# c %>">x</div>`)
  })

  test("parses as an ERBCommentNode", () => {
    const result = Herb.parse(`<%# a comment %>`)
    const node = result.value.children[0]

    expect(isERBCommentNode(node)).toBe(true)
    expect(node.type).toBe("AST_ERB_COMMENT_NODE")
  })

  test("a silent tag whose ruby is a comment stays an ERBContentNode", () => {
    const result = Herb.parse(`<% # a ruby comment %>`)
    const node = result.value.children[0]

    expect(isERBCommentNode(node)).toBe(false)
    expect(node.type).toBe("AST_ERB_CONTENT_NODE")
  })
})
