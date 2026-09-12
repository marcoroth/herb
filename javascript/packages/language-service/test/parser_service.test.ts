import { describe, it, expect, beforeAll } from "vitest"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"

import { ParserService } from "../src/parser_service"

const GRAPHQL_TEMPLATE = `<%graphql query Products($first: Int!) { products(first: $first) { id } } %>`

describe("ParserService", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function documentFor(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  describe("erb_openers", () => {
    it("reports a template using an unknown opener as broken Ruby", () => {
      const service = new ParserService(Herb)

      expect(service.parseDocument(documentFor(GRAPHQL_TEMPLATE)).diagnostics.length).toBeGreaterThan(0)
    })

    it("parses a configured opener without diagnostics", () => {
      const service = new ParserService(Herb)
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })

      expect(service.parseDocument(documentFor(GRAPHQL_TEMPLATE)).diagnostics).toEqual([])
    })

    it("applies the configured openers to parseContent as well", () => {
      const service = new ParserService(Herb)
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })

      expect(service.parseContent(GRAPHQL_TEMPLATE).recursiveErrors()).toEqual([])
    })

    it("lets a caller's own options sit on top of the configured ones", () => {
      const service = new ParserService(Herb)
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })

      const result = service.parseContent(GRAPHQL_TEMPLATE, { track_whitespace: true })

      expect(result.recursiveErrors()).toEqual([])
      expect(result.options.track_whitespace).toBe(true)
    })

    it("goes back to the default openers when the config is cleared", () => {
      const service = new ParserService(Herb)
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })
      service.setConfig(undefined)

      expect(service.parseDocument(documentFor(GRAPHQL_TEMPLATE)).diagnostics.length).toBeGreaterThan(0)
    })
  })

  describe("commentedERBTagPrefixes", () => {
    it("offers the prefixes a <%# commented built-in tag can carry", () => {
      const service = new ParserService(Herb)

      expect([...service.commentedERBTagPrefixes()].sort()).toEqual(["%", "%=", "-", "=", "=="].sort())
    })

    it("offers a configured opener alongside them", () => {
      const service = new ParserService(Herb)
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })

      expect(service.commentedERBTagPrefixes()).toContain("graphql")
    })

    it("orders the prefixes longest first so `%=` wins over `%`", () => {
      const service = new ParserService(Herb)
      const prefixes = service.commentedERBTagPrefixes()

      expect(prefixes.indexOf("%=")).toBeLessThan(prefixes.indexOf("%"))
      expect(prefixes.indexOf("==")).toBeLessThan(prefixes.indexOf("="))
    })
  })
})
