import { describe, test, expect } from "vitest"
import { Herb } from "../src/index-esm.mjs"

describe("@herb-tools/node", () => {
  test("loads the native extension successfully", () => {
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
      if (["version"].includes(expectedFunction)) {
        expect(typeof Herb[expectedFunction]).toBe("string")
      } else {
        expect(typeof Herb[expectedFunction]).toBe("function")
      }
    }
  })

  test("version() returns a string", () => {
    const version = Herb.version
    expect(typeof version).toBe("string")
    expect(version.length).toBeGreaterThan(0)
  })

  test("parse() can process a simple template", () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const result = Herb.parse(simpleHtml)
    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.source).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  test("extractRuby() extracts embedded Ruby code", () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const ruby = Herb.extractRuby(simpleHtml)
    expect(ruby).toBeDefined()
    expect(ruby).toBe('         "Hello World"         ')
  })

  test("extractHtml() extracts HTML content", () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const html = Herb.extractHtml(simpleHtml)
    expect(html).toBeDefined()
    expect(html).toBe("<div>                    </div>")
  })
})
