import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { elementName, elementSelector, erbLabel, defaultNodeLabelOptions } from "../src/node_labels"

import type { DocumentNode, HTMLElementNode } from "@herb-tools/core"

describe("node labels", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function firstElement(source: string): HTMLElementNode {
    const document = Herb.parse(source).value as DocumentNode

    return document.children.find(child => child.type === "AST_HTML_ELEMENT_NODE") as HTMLElementNode
  }

  describe("elementSelector", () => {
    it("returns an empty string for an element with neither id nor class", () => {
      expect(elementSelector(firstElement("<div>Content</div>"))).toBe("")
    })

    it("returns the id", () => {
      expect(elementSelector(firstElement(`<div id="main">Content</div>`))).toBe("#main")
    })

    it("returns the classes", () => {
      expect(elementSelector(firstElement(`<div class="card">Content</div>`))).toBe(".card")
    })

    it("returns the id and classes together", () => {
      expect(elementSelector(firstElement(`<div id="main" class="card wide">Content</div>`))).toBe("#main.card.wide")
    })

    it("keeps only the leading classes past the limit", () => {
      expect(elementSelector(firstElement(`<div class="flex items-center p-4">Content</div>`))).toBe(".flex.items-center")
    })

    it("honours a caller-supplied maximumClasses", () => {
      const node = firstElement(`<div class="card featured wide">Content</div>`)

      expect(elementSelector(node, { maximumClasses: 1 })).toBe(".card")
      expect(elementSelector(node, { maximumClasses: 3 })).toBe(".card.featured.wide")
    })

    it("names by id alone when maximumClasses is zero", () => {
      const node = firstElement(`<div id="main" class="card featured">Content</div>`)

      expect(elementSelector(node, { maximumClasses: 0 })).toBe("#main")
    })

    it("drops the excess instead of truncating when asked", () => {
      const node = firstElement(`<div class="card featured">Content</div>`)

      expect(elementSelector(node, { maximumClasses: 1, excessClasses: "drop" })).toBe("")
      expect(elementSelector(node, { maximumClasses: 2, excessClasses: "drop" })).toBe(".card.featured")
    })

    it("keeps the id when the excess classes are dropped", () => {
      const node = firstElement(`<div id="main" class="card featured">Content</div>`)

      expect(elementSelector(node, { maximumClasses: 1, excessClasses: "drop" })).toBe("#main")
    })

    it("drops a class list built at runtime", () => {
      expect(elementSelector(firstElement(`<div class="card <%= extra %>">Content</div>`))).toBe("")
    })
  })

  describe("elementName", () => {
    it("prefixes the tag name", () => {
      expect(elementName(firstElement(`<section id="main" class="card">Content</section>`))).toBe("section#main.card")
    })

    it("falls back to a placeholder when the tag name is missing", () => {
      expect(elementName(firstElement("<div>Content</div>"))).toBe("div")
    })
  })

  describe("erbLabel", () => {
    it("returns an empty string for nothing", () => {
      expect(erbLabel(null)).toBe("")
      expect(erbLabel(undefined)).toBe("")
      expect(erbLabel("   ")).toBe("")
    })

    it("trims", () => {
      expect(erbLabel("  if user.admin?  ")).toBe("if user.admin?")
    })

    it("collapses a multi-line call onto one line", () => {
      expect(erbLabel(dedent`
        content_tag :div,
          class: "card"
      `)).toBe("content_tag :div, class: \"card\"")
    })

    it("truncates past the limit", () => {
      const limit = defaultNodeLabelOptions.erbLabelLimit
      const label = erbLabel("a".repeat(limit + 10))

      expect(label).toBe(`${"a".repeat(limit)}…`)
      expect(label.length).toBe(limit + 1)
    })

    it("does not truncate at the limit", () => {
      const content = "a".repeat(defaultNodeLabelOptions.erbLabelLimit)

      expect(erbLabel(content)).toBe(content)
    })

    it("honours a caller-supplied limit", () => {
      expect(erbLabel("if user.admin?", { erbLabelLimit: 5 })).toBe("if us…")
    })
  })
})
