import { describe, it, expect, beforeAll } from "vitest"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Herb } from "@herb-tools/node-wasm"

import { ParserService } from "../src/parser_service"

const GRAPHQL_TEMPLATE = `<%graphql query Products($first: Int!) { products(first: $first) { id } } %>`

describe("ParserService", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function documentFor(content: string, uri = "file:///test.html.erb"): TextDocument {
    return TextDocument.create(uri, "erb", 1, content)
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

  describe("config resolver", () => {
    const STOREFRONT = "file:///workspace/storefront/index.html.erb"
    const ADMIN = "file:///workspace/admin/index.html.erb"

    function serviceForTwoProjects(): ParserService {
      const service = new ParserService(Herb)

      service.setConfigResolver(uri => (
        uri.startsWith("file:///workspace/storefront/") ? { parserOptions: { erb_openers: ["graphql"] } } : undefined
      ))

      return service
    }

    it("parses a document with the openers of the project it belongs to", () => {
      const service = serviceForTwoProjects()

      expect(service.parseDocument(documentFor(GRAPHQL_TEMPLATE, STOREFRONT)).diagnostics).toEqual([])
      expect(service.parseDocument(documentFor(GRAPHQL_TEMPLATE, ADMIN)).diagnostics.length).toBeGreaterThan(0)
    })

    it("parses content with the openers of the URI it came from", () => {
      const service = serviceForTwoProjects()

      expect(service.parseContent(GRAPHQL_TEMPLATE, undefined, STOREFRONT).recursiveErrors()).toEqual([])
      expect(service.parseContent(GRAPHQL_TEMPLATE, undefined, ADMIN).recursiveErrors().length).toBeGreaterThan(0)
    })

    it("offers the prefixes of the project a URI belongs to", () => {
      const service = serviceForTwoProjects()

      expect(service.commentedERBTagPrefixes(undefined, STOREFRONT)).toContain("graphql")
      expect(service.commentedERBTagPrefixes(undefined, ADMIN)).not.toContain("graphql")
    })

    it("falls back to the configured config for a URI no project covers", () => {
      const service = serviceForTwoProjects()
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })

      expect(service.parseDocument(documentFor(GRAPHQL_TEMPLATE, ADMIN)).diagnostics).toEqual([])
    })

    it("keeps using the configured config when no URI is given", () => {
      const service = serviceForTwoProjects()
      service.setConfig({ parserOptions: { erb_openers: ["graphql"] } })

      expect(service.parseContent(GRAPHQL_TEMPLATE).recursiveErrors()).toEqual([])
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
