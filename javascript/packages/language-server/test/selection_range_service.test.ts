import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Position } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"

import { SelectionRangeService } from "../src/selection_range_service"
import { ParserService } from "../src/parser_service"
import { Herb } from "@herb-tools/node-wasm"

describe("SelectionRangeService", () => {
  let parserService: ParserService
  let service: SelectionRangeService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
    service = new SelectionRangeService(parserService)
  })

  function createDocument(content: string): TextDocument {
    return TextDocument.create("file:///test.html.erb", "erb", 1, content)
  }

  function getSelectionRange(content: string, line: number, character: number) {
    const document = createDocument(content)
    const ranges = service.getSelectionRanges(document, [Position.create(line, character)])
    return ranges[0]
  }

  function rangeChain(content: string, line: number, character: number) {
    let range = getSelectionRange(content, line, character)
    const chain: { start: { line: number; character: number }; end: { line: number; character: number } }[] = []

    while (range) {
      chain.push({
        start: { line: range.range.start.line, character: range.range.start.character },
        end: { line: range.range.end.line, character: range.range.end.character },
      })
      range = range.parent!
    }

    return chain
  }

  describe("simple HTML", () => {
    it("returns expanding ranges from text to element to document", () => {
      const content = "<div>hello</div>"
      const chain = rangeChain(content, 0, 6)

      expect(chain.length).toBeGreaterThanOrEqual(3)
      expect(chain[0].start).toEqual({ line: 0, character: 5 })
      expect(chain[0].end).toEqual({ line: 0, character: 10 })
      expect(chain[1].start).toEqual({ line: 0, character: 0 })
      expect(chain[1].end).toEqual({ line: 0, character: 16 })
    })

    it("expands from attribute value to attribute to open tag to element", () => {
      const content = '<div class="foo">hello</div>'
      const chain = rangeChain(content, 0, 13)

      expect(chain.length).toBeGreaterThanOrEqual(5)
      expect(chain[0].start).toEqual({ line: 0, character: 12 })
      expect(chain[0].end).toEqual({ line: 0, character: 15 })
      expect(chain[1].start).toEqual({ line: 0, character: 11 })
      expect(chain[1].end).toEqual({ line: 0, character: 16 })
      expect(chain[2].start).toEqual({ line: 0, character: 5 })
      expect(chain[2].end).toEqual({ line: 0, character: 16 })
    })

    it("handles void elements", () => {
      const content = "<br>"
      const chain = rangeChain(content, 0, 1)

      expect(chain.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe("multiline HTML", () => {
    it("expands through nested elements", () => {
      const content = dedent`
        <div>
          <span>text</span>
        </div>
      `
      const chain = rangeChain(content, 1, 8)

      expect(chain.length).toBeGreaterThanOrEqual(3)
      expect(chain[0].start.line).toBe(1)
      expect(chain[1].start.line).toBe(1)
      expect(chain[1].end.line).toBe(1)
    })
  })

  describe("ERB control flow", () => {
    it("expands through ERB if block", () => {
      const content = dedent`
        <% if condition %>
          hello
        <% end %>
      `
      const chain = rangeChain(content, 1, 3)

      expect(chain.length).toBeGreaterThanOrEqual(3)
      expect(chain[0].start).toEqual({ line: 0, character: 18 })
      expect(chain[0].end.line).toBe(2)
      expect(chain[1].start.line).toBe(0)
      expect(chain[1].end.line).toBe(2)
    })

    it("expands through nested ERB blocks", () => {
      const content = dedent`
        <% if outer %>
          <% if inner %>
            content
          <% end %>
        <% end %>
      `
      const chain = rangeChain(content, 2, 6)

      expect(chain.length).toBeGreaterThanOrEqual(4)
      expect(chain[0].start.line).toBe(1)
      expect(chain[1].start.line).toBe(1)
      expect(chain[1].end.line).toBe(3)
      expect(chain[2].start.line).toBe(0)
      expect(chain[2].end.line).toBe(4)
    })
  })

  describe("ERB content", () => {
    it("expands from ERB content tag", () => {
      const content = "<%= hello %>"
      const chain = rangeChain(content, 0, 5)

      expect(chain.length).toBeGreaterThanOrEqual(2)
      expect(chain[0].start).toEqual({ line: 0, character: 0 })
      expect(chain[0].end).toEqual({ line: 0, character: 12 })
    })
  })

  describe("mixed HTML and ERB", () => {
    it("expands from text inside ERB inside HTML", () => {
      const content = dedent`
        <div>
          <% if condition %>
            <span>text</span>
          <% end %>
        </div>
      `
      const chain = rangeChain(content, 2, 10)
      expect(chain.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe("interpolated attribute values", () => {
    it("expands through all levels for literal inside interpolated attribute", () => {
      const content = '<div class="1231312 <%= hello %>">1231</div>'
      const chain = rangeChain(content, 0, 15)

      expect(chain.length).toBeGreaterThanOrEqual(5)
      expect(chain[0].start).toEqual({ line: 0, character: 12 })
      expect(chain[0].end).toEqual({ line: 0, character: 20 })
      expect(chain[1].start).toEqual({ line: 0, character: 11 })
      expect(chain[1].end).toEqual({ line: 0, character: 33 })
      expect(chain[2].start).toEqual({ line: 0, character: 5 })
      expect(chain[2].end).toEqual({ line: 0, character: 33 })
      expect(chain[3].start).toEqual({ line: 0, character: 0 })
      expect(chain[3].end).toEqual({ line: 0, character: 34 })
      expect(chain[4].start).toEqual({ line: 0, character: 0 })
      expect(chain[4].end).toEqual({ line: 0, character: 44 })
    })
  })

  describe("multiple positions", () => {
    it("returns selection ranges for each position", () => {
      const content = "<div>hello</div>"
      const document = createDocument(content)
      const ranges = service.getSelectionRanges(document, [
        Position.create(0, 2),
        Position.create(0, 7),
      ])

      expect(ranges).toHaveLength(2)
    })
  })

  describe("HTML comments", () => {
    it("expands through comment node", () => {
      const content = "<!-- comment -->"
      const chain = rangeChain(content, 0, 6)

      expect(chain.length).toBeGreaterThanOrEqual(3)
      expect(chain[0].start).toEqual({ line: 0, character: 4 })
      expect(chain[0].end).toEqual({ line: 0, character: 13 })
      expect(chain[1].start).toEqual({ line: 0, character: 0 })
      expect(chain[1].end).toEqual({ line: 0, character: 16 })
    })
  })
})
