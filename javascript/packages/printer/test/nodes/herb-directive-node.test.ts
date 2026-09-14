import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HerbDirectiveNode, isHerbDirectiveNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("HerbDirectiveNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HerbDirectiveNode.build({
      location: createLocation(),
      tag_opening: createToken("TOKEN_ERB_START", "<%#"),
      content: createToken("TOKEN_ERB_CONTENT", " herb:disable erb-comment-syntax "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      key: createToken("TOKEN_IDENTIFIER", "disable"),
      arguments: createToken("TOKEN_ERB_CONTENT", "erb-comment-syntax")
    })

    expectNodeToPrint(node, "<%# herb:disable erb-comment-syntax %>")
  })

  test("can print from node without arguments", () => {
    const node = HerbDirectiveNode.build({
      location: createLocation(),
      tag_opening: createToken("TOKEN_ERB_START", "<%#"),
      content: createToken("TOKEN_ERB_CONTENT", " herb:disable "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      key: createToken("TOKEN_IDENTIFIER", "disable"),
      arguments: null
    })

    expectNodeToPrint(node, "<%# herb:disable %>")
  })

  test("parses into a HerbDirectiveNode when the option is enabled", () => {
    const node = Herb.parse("<%# herb:disable erb-comment-syntax %>", { herb_directives: true }).value.children[0]

    expect(isHerbDirectiveNode(node)).toBe(true)

    if (isHerbDirectiveNode(node)) {
      expect(node.key?.value).toBe("disable")
      expect(node.arguments?.value).toBe("erb-comment-syntax")
    }
  })

  test("stays an ERBContentNode when the option is disabled", () => {
    const node = Herb.parse("<%# herb:disable erb-comment-syntax %>").value.children[0]

    expect(isHerbDirectiveNode(node)).toBe(false)
  })

  test("can print disable directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:disable erb-comment-syntax %>
    `, true, { herb_directives: true })
  })

  test("can print disable directive with several rules from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:disable erb-comment-syntax, html-tag-name-lowercase %>
    `, true, { herb_directives: true })
  })

  test("can print disable directive without rules from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:disable %>
    `, true, { herb_directives: true })
  })

  test("can print malformed disable directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:disable erb-comment-syntax, %>
    `, true, { herb_directives: true })
  })

  test("can print slots directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:slots client %>
    `, true, { herb_directives: true })
  })

  test("can print formatter ignore directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:formatter ignore %>
    `, true, { herb_directives: true })
  })

  test("can print linter ignore directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:linter ignore %>
    `, true, { herb_directives: true })
  })

  test("can print key directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:key item.id %>
    `, true, { herb_directives: true })
  })

  test("can print unknown directive from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:blahblah %>
    `, true, { herb_directives: true })
  })

  test("can print directive alongside markup from source", () => {
    expectPrintRoundTrip(dedent`
      <div>text</div>
      <%# herb:disable html-tag-name-lowercase %>
    `, true, { herb_directives: true })
  })

  test("can print directive inside a block from source", () => {
    expectPrintRoundTrip(`<% items.each do |item| %>\n  <%# herb:key item.id %>\n<% end %>`, true, { herb_directives: true })
  })

  test("can print directive with a trim marker closing from source", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:slots client -%>
    `, true, { herb_directives: true })
  })

  test("does not become a directive without the option enabled", () => {
    expectPrintRoundTrip(dedent`
      <%# herb:disable erb-comment-syntax %>
    `)
  })
})
