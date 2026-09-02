import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HerbStateDirectiveNode, isHerbStateDirectiveNode, isHerbStateDeclarationNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("HerbStateDirectiveNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HerbStateDirectiveNode.build({
      location: createLocation(),
      tag_opening: createToken("TOKEN_ERB_START", "<%#"),
      content: createToken("TOKEN_ERB_CONTENT", " herb:state (open: false) "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      key: createToken("TOKEN_IDENTIFIER", "state"),
      signature: createToken("TOKEN_ERB_CONTENT", "(open: false)"),
      states: []
    })

    expectNodeToPrint(node, "<%# herb:state (open: false) %>")
  })

  test("parses into a HerbStateDirectiveNode when the option is enabled", () => {
    const node = Herb.parse("<%# herb:state (open: false, count: 0) %>", { herb_directives: true }).value.children[0]

    expect(isHerbStateDirectiveNode(node)).toBe(true)

    if (isHerbStateDirectiveNode(node)) {
      expect(node.key?.value).toBe("state")
      expect(node.signature?.value).toBe("(open: false, count: 0)")
      expect(node.states.filter(isHerbStateDeclarationNode).map((state) => [state.name?.value, state.kind])).toEqual([["open", "boolean"], ["count", "integer"]])
    }
  })

  test("stays an ERBContentNode when the option is disabled", () => {
    const node = Herb.parse("<%# herb:state (open: false) %>").value.children[0]

    expect(isHerbStateDirectiveNode(node)).toBe(false)
  })

  test("can print from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (open: false) %>
    `, true, { herb_directives: true })
  })

  test("can print several states from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (open: false, count: 0, title: "") %>
    `, true, { herb_directives: true })
  })

  test("can print every default kind from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (a: true, b: 0, c: 1.5, d: "s", e: :sym, f: nil, g: [], h: {}, i: bare) %>
    `, true, { herb_directives: true })
  })

  test("can print an empty signature from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state () %>
    `, true, { herb_directives: true })
  })

  test("can print inside an iteration block from source", () => {
    expectPrintRoundTrip(`<% items.each do |item| %>\n  <%# herb:state (open: false) %>\n<% end %>`, true, { herb_directives: true })
  })

  test("can print alongside strict locals from source", () => {
    expectPrintRoundTrip(`<%# locals: (message:) %>\n<%# herb:state (open: false) %>`, true, { herb_directives: true, strict_locals: true })
  })

  test("can print a non-canonical spelling from source", () => {
    expectPrintRoundTrip(dedent`
      <%#- herb:state (open: false) -%>
    `, false, { herb_directives: true })
  })

  test("can print a signature spread across several lines from source", () => {
    expectPrintRoundTrip(`<%# herb:state (\n  open: false,\n  count: 0\n) %>`, false, { herb_directives: true })
  })

  test("can print a directive without parentheses from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state open: false %>
    `, false, { herb_directives: true })
  })

  test("can print a signature that does not parse from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (1 +) %>
    `, false, { herb_directives: true })
  })

  test("does not become a directive without the option enabled", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (open: false) %>
    `)
  })
})
