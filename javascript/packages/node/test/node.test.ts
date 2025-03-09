import { describe, test, expect } from "vitest"
import { Herb } from "@herb-tools/node"

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
      "backend",
    ]

    for (const func of expectedFunctions) {
      expect(typeof Herb[func]).toBe("function")
    }
  })

  test("version() returns a string", () => {
    const version = Herb.version()
    expect(typeof version).toBe("string")
    expect(version.length).toBeGreaterThan(0)
  })

  test("parse() can process a simple template", () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const result = Herb.parse(simpleHtml)
    expect(result).toBeDefined()
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
