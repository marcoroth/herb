import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { StrictLocalsCollector } from "../src/strict_locals_collector"
import { ParserService } from "../src/parser_service"

describe("StrictLocalsCollector", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()
    parserService = new ParserService()
  })

  function collect(source: string): StrictLocalsCollector {
    const result = parserService.parseContent(source, { strict_locals: true })
    const collector = new StrictLocalsCollector()

    collector.visit(result.value)

    return collector
  }

  function names(source: string): string[] {
    return [...collect(source).names]
  }

  describe("declared", () => {
    it("is false without a declaration", () => {
      expect(collect(`<div><%= user.name %></div>`).declared).toBe(false)
    })

    it("is true with a declaration", () => {
      expect(collect(`<%# locals: (user:) %>\n<div></div>`).declared).toBe(true)
    })

    it("is true for an empty declaration", () => {
      const collector = collect(`<%# locals: () %>\n<div></div>`)

      expect(collector.declared).toBe(true)
      expect([...collector.names]).toEqual([])
    })
  })

  describe("names", () => {
    it("collects required keyword locals", () => {
      expect(names(`<%# locals: (user:, title:) %>\n<div></div>`)).toEqual(["user", "title"])
    })

    it("collects keyword locals with default values", () => {
      expect(names(`<%# locals: (user:, size: "sm", count: 0) %>\n<div></div>`)).toEqual(["user", "size", "count"])
    })

    it("ignores positional parameters", () => {
      expect(names(`<%# locals: (user, title:) %>\n<div></div>`)).toEqual(["title"])
    })

    it("ignores a double splat", () => {
      expect(names(`<%# locals: (user:, **options) %>\n<div></div>`)).toEqual(["user"])
    })

    it("ignores an anonymous double splat", () => {
      expect(names(`<%# locals: (user:, **) %>\n<div></div>`)).toEqual(["user"])
    })

    it("deduplicates repeated names", () => {
      const collector = collect(dedent`
        <%# locals: (user:) %>
        <%# locals: (user:, title:) %>
        <div></div>
      `)

      expect([...collector.names]).toEqual(["user", "title"])
    })

    it("collects nothing without a declaration", () => {
      expect(names(`<div><%= user.name %></div>`)).toEqual([])
    })
  })
})
