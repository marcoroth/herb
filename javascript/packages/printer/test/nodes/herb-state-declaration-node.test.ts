import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HerbStateDeclarationNode, RubyLiteralNode, isHerbStateDirectiveNode, isHerbStateDeclarationNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("HerbStateDeclarationNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("prints nothing from constructed node", () => {
    const node = HerbStateDeclarationNode.build({
      location: createLocation(),
      name: createToken("TOKEN_IDENTIFIER", "open"),
      default_value: RubyLiteralNode.build({
        location: createLocation(),
        content: "false"
      }),
      kind: "boolean"
    })

    expectNodeToPrint(node, "")
  })

  test("prints nothing from constructed node without a default", () => {
    const node = HerbStateDeclarationNode.build({
      location: createLocation(),
      name: createToken("TOKEN_IDENTIFIER", "open"),
      default_value: null,
      kind: "missing"
    })

    expectNodeToPrint(node, "")
  })

  test("classifies defaults the way Prism does", () => {
    const source = `<%# herb:state (a: true, b: 0, c: 1e3, d: "s", e: :sym, f: nil, g: [], h: {}, i: bare) %>`
    const node = Herb.parse(source, { herb_directives: true }).value.children[0]

    expect(isHerbStateDirectiveNode(node)).toBe(true)

    if (isHerbStateDirectiveNode(node)) {
      expect(node.states.filter(isHerbStateDeclarationNode).map((state) => state.kind)).toEqual([
        "boolean", "integer", "float", "string", "symbol", "nil", "array", "hash", "bare"
      ])
    }
  })

  test("does not print separately when declared in a state directive", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (open: false) %>
    `, true, { herb_directives: true })
  })

  test("does not print separately with several declarations", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (open: false, count: 0) %>
    `, true, { herb_directives: true })
  })

  test("does not print separately with a string default", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (title: "Hello, world!") %>
    `, true, { herb_directives: true })
  })

  test("does not print separately with a bare default", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:state (theme: preferred_theme) %>
    `, true, { herb_directives: true })
  })
})
