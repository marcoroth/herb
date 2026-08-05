import { describe, test, expect } from "vitest"

import { HerbHTMLNode } from "../src/herb-html-node.js"
import { setupHerb, createService, createDocument } from "./helpers.js"

describe("HerbHTMLNode", () => {
  setupHerb()

  test("getAttributeNameRange returns correct range", () => {
    const service = createService()
    const source = '<div data-controller="scroll"></div>'
    const document = createDocument(source)
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    const range = node.getAttributeNameRange("data-controller")

    expect(range).toBeDefined()
    expect(source.slice(range!.start, range!.end)).toBe("data-controller")
  })

  test("getAttributeValueRange returns correct range", () => {
    const service = createService()
    const source = '<div data-controller="scroll"></div>'
    const document = createDocument(source)
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    const range = node.getAttributeValueRange("data-controller")

    expect(range).toBeDefined()
    expect(source.slice(range!.start, range!.end)).toBe('"scroll"')
  })

  test("getAttributeValueTokenRange finds specific token", () => {
    const service = createService()
    const source = '<div data-controller="scroll hello"></div>'
    const document = createDocument(source)
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    const range = node.getAttributeValueTokenRange("data-controller", "hello", source)

    expect(range).toBeDefined()
    expect(source.slice(range!.start, range!.end)).toBe("hello")
  })

  test("getAttributeValueTokenRange does not match partial tokens", () => {
    const service = createService()
    const source = '<div data-controller="collapsible bl"></div>'
    const document = createDocument(source)
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    const range = node.getAttributeValueTokenRange("data-controller", "bl", source)

    expect(range).toBeDefined()
    expect(source.slice(range!.start, range!.end)).toBe("bl")

    const charBefore = source[range!.start - 1]
    expect(charBefore).toBe(" ")
  })

  test("isTokenListAttribute returns correct value", () => {
    const service = createService()
    const document = createDocument('<div data-controller="scroll" title="hello"></div>')
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    expect(node.isTokenListAttribute("data-controller")).toBe(true)
    expect(node.isTokenListAttribute("title")).toBe(false)
    expect(node.isTokenListAttribute("class")).toBe(true)
  })

  test("getAttributeNameRange returns null for missing attributes", () => {
    const service = createService()
    const document = createDocument("<div></div>")
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    expect(node.getAttributeNameRange("nonexistent")).toBeNull()
  })

  test("isSameTag compares case-insensitively", () => {
    const service = createService()
    const document = createDocument("<DIV></DIV>")
    const html = service.parseHTMLDocument(document)
    const node = html.roots[0] as HerbHTMLNode

    expect(node.isSameTag("div")).toBe(true)
    expect(node.isSameTag("span")).toBe(false)
  })
})
