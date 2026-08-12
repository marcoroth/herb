import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"

import { ERBStringToDirectOutputRewriter, isSafeToInline } from "../../src/built-ins/erb-string-to-direct-output.js"

import type { ReplacementPart } from "../../src/built-ins/erb-string-to-direct-output.js"
import type { HTMLAttributeValueNode } from "@herb-tools/core"

function rewrite(input: string): string {
  const rewriter = new ERBStringToDirectOutputRewriter()
  const parseResult = Herb.parse(input, { track_whitespace: true, prism_nodes: true })

  return IdentityPrinter.print(rewriter.rewrite(parseResult.value, { baseDir: process.cwd() }))
}

function attributeValue(quoted: boolean, quote: string | null): HTMLAttributeValueNode {
  return { quoted, open_quote: quote === null ? null : { value: quote } } as HTMLAttributeValueNode
}

function text(content: string): ReplacementPart[] {
  return [{ type: "text", content }]
}

describe("erb-string-to-direct-output", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("isSafeToInline", () => {
    test("accepts plain text", () => {
      expect(isSafeToInline(text("Title"))).toBe(true)
    })

    test("accepts expression parts", () => {
      expect(isSafeToInline([{ type: "expression", expression: "a & b" }])).toBe(true)
    })

    test("rejects text that would be parsed as markup", () => {
      expect(isSafeToInline(text("a <b> c"))).toBe(false)
    })

    test("rejects text that would stop being escaped", () => {
      expect(isSafeToInline(text("a & b"))).toBe(false)
    })

    test("rejects an unsafe part among safe ones", () => {
      expect(isSafeToInline([{ type: "text", content: "ok" }, { type: "expression", expression: "a" }, { type: "text", content: "&" }])).toBe(false)
    })

    test("accepts `<` and `&` for unescaped output", () => {
      expect(isSafeToInline(text("<b>a & b</b>"), { escaped: false })).toBe(true)
    })

    test("rejects any text in an unquoted attribute value", () => {
      expect(isSafeToInline(text("Title"), { attributeValue: attributeValue(false, null) })).toBe(false)
      expect(isSafeToInline(text("Title"), { attributeValue: attributeValue(false, null), escaped: false })).toBe(false)
    })

    test("rejects text containing the quote that encloses the attribute value", () => {
      expect(isSafeToInline(text(`say "hi"`), { attributeValue: attributeValue(true, `"`) })).toBe(false)
      expect(isSafeToInline(text("it's"), { attributeValue: attributeValue(true, "'") })).toBe(false)
    })

    test("accepts text containing a quote the attribute value does not use", () => {
      expect(isSafeToInline(text("it's"), { attributeValue: attributeValue(true, `"`) })).toBe(true)
    })
  })

  describe("rewrite", () => {
    test("replaces a string literal with text", () => {
      expect(rewrite('<p><%= "Title" %></p>')).toBe("<p>Title</p>")
    })

    test("splits an interpolated string into separate tags", () => {
      expect(rewrite('<p><%= "#{a} and #{b}" %></p>')).toBe("<p><%= a %> and <%= b %></p>")
    })

    test("keeps a string literal in an unquoted attribute value", () => {
      const input = '<div id=<%= "#{a}_#{b}" %>>y</div>'

      expect(rewrite(input)).toBe(input)
    })

    test("keeps text that would be parsed as markup", () => {
      const input = '<p><%= "#{a} <request body> -- #{b}" %></p>'

      expect(rewrite(input)).toBe(input)
    })

    test("keeps text that would stop being escaped", () => {
      const input = '<p><%= "a & b" %></p>'

      expect(rewrite(input)).toBe(input)
    })

    test("keeps text containing the quote that encloses the attribute value", () => {
      const input = `<div title="<%= "say \\"hi\\"" %>">y</div>`

      expect(rewrite(input)).toBe(input)
    })

    test("replaces an interpolated string in a quoted attribute value", () => {
      expect(rewrite('<div id="<%= "#{a}_#{b}" %>">y</div>')).toBe('<div id="<%= a %>_<%= b %>">y</div>')
    })
  })
})
