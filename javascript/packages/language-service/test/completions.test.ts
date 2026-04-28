import { describe, test, expect } from "vitest"

import { Position } from "../src/index.js"
import { setupHerb, createService, createDocument } from "./helpers.js"

describe("doComplete", () => {
  setupHerb()

  describe("regular HTML", () => {
    test("provides attribute value completions", () => {
      const service = createService()
      const document = createDocument(`<div data-controller=""></div>`)
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 22), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("scroll")
      expect(labels).toContain("hello")
      expect(labels).toContain("search")
    })

    test("provides attribute name completions", () => {
      const service = createService()
      const document = createDocument("<div ></div>")
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 5), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("data-controller")
      expect(labels).toContain("data-action")
    })
  })

  describe("ActionView tag helpers", () => {
    test("provides attribute value completions for data-controller", () => {
      const service = createService()
      const document = createDocument(`<%= tag.div data: { controller: "" } %>`)
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 33), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("scroll")
      expect(labels).toContain("hello")
      expect(labels).toContain("search")
    })

    test("provides attribute value completions for data-action", () => {
      const service = createService()
      const document = createDocument(`<%= tag.div data: { action: "" } %>`)
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 29), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("click->scroll#go")
    })

    test("provides completions for second value in multi-value attribute", () => {
      const service = createService()
      const source = '<%= tag.div data: { controller: "collapsible s" } %>'
      const document = createDocument(source)
      const html = service.parseHTMLDocument(document)
      const cursorOffset = source.indexOf("s\"") + 1

      const completions = service.doComplete(document, document.positionAt(cursorOffset), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)
      expect(labels).toContain("scroll")
      expect(labels).toContain("search")

      const firstItem = completions.items[0]

      if (firstItem.textEdit && "range" in firstItem.textEdit) {
        const editStart = document.offsetAt(firstItem.textEdit.range.start)
        const editEnd = document.offsetAt(firstItem.textEdit.range.end)
        expect(source.slice(editStart, editEnd)).toBe("s")
      }
    })

    test("provides underscored attribute names inside data: {} hash", () => {
      const service = createService()
      const source = '<%= tag.div(data: { controller: "dropdown",  }) %>'
      const document = createDocument(source)

      const html = service.parseHTMLDocument(document)
      const cursorOffset = source.indexOf(",  }") + 2
      const completions = service.doComplete(document, document.positionAt(cursorOffset), html)

      expect(completions.items.length).toBeGreaterThan(0)

      const labels = completions.items.map(item => item.label)

      expect(labels).toContain("action")
      expect(labels).toContain("target")

      expect(labels).not.toContain("data-controller")
      expect(labels).not.toContain("data-action")
      expect(labels).not.toContain("controller")
    })

    test("returns empty completions for unknown attributes", () => {
      const service = createService()
      const document = createDocument('<%= tag.div data: { unknown: "" } %>')
      const html = service.parseHTMLDocument(document)
      const completions = service.doComplete(document, Position.create(0, 30), html)

      expect(completions.items).toHaveLength(0)
    })
  })
})
