import { describe, test, expect } from "vitest"
import { Herb } from "../src"

describe("@herb-tools/browser", () => {
  test("loads wasm successfully", () => {
    expect(Herb).toBeDefined()
  })

  test("has all expected functions", () => {
    const expectedFunctions = [
      "lex",
      "lexFile",
      "parse",
      "parseFile",
      "lexToJson",
      "extractRuby",
      "extractHtml",
      "version",
    ]

    for (const expectedFunction of expectedFunctions) {
      expect(typeof Herb[expectedFunction]).toBe("function")
    }
  })

  test("version() returns a string", async () => {
    const version = await Herb.version()
    expect(typeof version).toBe("string")
    expect(version.length).toBeGreaterThan(0)
  })

  test("parse() can process a simple template", async () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const result = await Herb.parse(simpleHtml)
    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.source).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  test("extractRuby() extracts embedded Ruby code", async () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const ruby = await Herb.extractRuby(simpleHtml)
    expect(ruby).toBeDefined()
    expect(ruby).toBe('         "Hello World"         ')
  })

  test("extractHtml() extracts HTML content", async () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const html = await Herb.extractHtml(simpleHtml)
    expect(html).toBeDefined()
    expect(html).toBe("<div>                    </div>")
  })
})
