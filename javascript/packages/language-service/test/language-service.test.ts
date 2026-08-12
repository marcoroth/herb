import dedent from "dedent"
import { describe, test, expect } from "vitest"

import { Position } from "../src/index.js"
import { setupHerb, createService, createDocument } from "./helpers.js"

import type { IHTMLDataProvider } from "../src/index.js"

describe("@herb-tools/language-service", () => {
  setupHerb()

  describe("getLanguageService", () => {
    test("returns a language service", () => {
      const service = createService()

      expect(service).toBeDefined()
      expect(service.parseHTMLDocument).toBeTypeOf("function")
      expect(service.doComplete).toBeTypeOf("function")
      expect(service.doHover).toBeTypeOf("function")
    })
  })

  describe("doHover", () => {
    test("provides hover for HTML tag names", () => {
      const service = createService()
      const document = createDocument("<div></div>")
      const html = service.parseHTMLDocument(document)
      const hover = service.doHover(document, Position.create(0, 2), html)

      expect(hover).toBeDefined()
    })

    test("provides hover for HTML attributes", () => {
      const service = createService()
      const document = createDocument('<div class="foo"></div>')
      const html = service.parseHTMLDocument(document)
      const hover = service.doHover(document, Position.create(0, 7), html)

      expect(hover).toBeDefined()
    })

    test("returns null for positions outside elements", () => {
      const service = createService()
      const document = createDocument("hello world")
      const html = service.parseHTMLDocument(document)
      const hover = service.doHover(document, Position.create(0, 5), html)

      expect(hover).toBeNull()
    })
  })

  describe("doTagComplete", () => {
    test("completes closing tag after >", () => {
      const service = createService()
      const document = createDocument("<div>text")
      const html = service.parseHTMLDocument(document)
      const result = service.doTagComplete(document, Position.create(0, 5), html)

      expect(result === null || result === "$0</div>").toBe(true)
    })

    test("does not complete void elements", () => {
      const service = createService()
      const document = createDocument("<br>")
      const html = service.parseHTMLDocument(document)
      const result = service.doTagComplete(document, Position.create(0, 4), html)

      expect(result).toBeNull()
    })
  })

  describe("findDocumentSymbols", () => {
    test("returns symbols for HTML elements", () => {
      const service = createService()
      const document = createDocument("<div><span></span></div>")
      const html = service.parseHTMLDocument(document)
      const symbols = service.findDocumentSymbols(document, html)

      expect(symbols.length).toBeGreaterThan(0)
    })

    test("findDocumentSymbols2 returns nested symbols", () => {
      const service = createService()
      const document = createDocument('<div id="main"><span></span></div>')
      const html = service.parseHTMLDocument(document)
      const symbols = service.findDocumentSymbols2(document, html)

      expect(symbols.length).toBeGreaterThan(0)
    })
  })

  describe("findDocumentHighlights", () => {
    test("highlights matching open and close tags", () => {
      const service = createService()
      const document = createDocument("<div></div>")
      const html = service.parseHTMLDocument(document)
      const highlights = service.findDocumentHighlights(document, Position.create(0, 2), html)

      expect(highlights.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("getFoldingRanges", () => {
    test("returns folding ranges for nested elements", () => {
      const service = createService()
      const document = createDocument(dedent`
        <div>
          <span>content</span>
        </div>
      `)
      const ranges = service.getFoldingRanges(document)

      expect(ranges.length).toBeGreaterThan(0)
    })
  })

  describe("getSelectionRanges", () => {
    test("returns selection ranges for a position", () => {
      const service = createService()
      const document = createDocument("<div><span>text</span></div>")
      const html = service.parseHTMLDocument(document)
      const ranges = service.getSelectionRanges(document, [Position.create(0, 12)])

      expect(ranges).toHaveLength(1)
      expect(ranges[0].parent).toBeDefined()
    })
  })

  describe("findMatchingTagPosition", () => {
    test("finds the closing tag from the opening tag", () => {
      const service = createService()
      const document = createDocument("<div></div>")
      const html = service.parseHTMLDocument(document)
      const position = service.findMatchingTagPosition(document, Position.create(0, 2), html)

      expect(position).toBeDefined()
      expect(position!.character).toBe(8)
    })
  })

  describe("findLinkedEditingRanges", () => {
    test("returns linked ranges for tag pairs", () => {
      const service = createService()
      const document = createDocument("<div></div>")
      const html = service.parseHTMLDocument(document)
      const ranges = service.findLinkedEditingRanges(document, Position.create(0, 2), html)

      expect(ranges).toBeDefined()
      expect(ranges!).toHaveLength(2)
    })
  })

  describe("format", () => {
    test("formats HTML content", () => {
      const service = createService()
      const document = createDocument("<div><span>text</span></div>")
      const edits = service.format(document, undefined, { tabSize: 2, insertSpaces: true })

      expect(edits.length).toBeGreaterThan(0)
    })
  })

  describe("createScanner", () => {
    test("tokenizes HTML content", () => {
      const service = createService()
      const scanner = service.createScanner("<div>")
      const tokenType = scanner.scan()

      expect(tokenType).toBeDefined()
      expect(scanner.getTokenText()).toBe("<")
    })
  })

  describe("setDataProviders", () => {
    test("updates data providers", () => {
      const service = createService()

      const newProvider: IHTMLDataProvider = {
        getId: () => "new",
        isApplicable: () => true,
        provideTags: () => [],
        provideAttributes: () => [{ name: "data-custom" }],
        provideValues: () => [],
      }

      service.setDataProviders(true, [newProvider])

      const document = createDocument("<div ></div>")
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 5), html)
      const labels = completions.items.map(item => item.label)

      expect(labels).toContain("data-custom")
    })
  })
})
