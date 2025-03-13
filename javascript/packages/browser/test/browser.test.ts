import { describe, test, expect, beforeAll } from "vitest"
import { Herb, HerbBackend } from "../src"

describe("@herb-tools/browser", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("loads wasm successfully", () => {
    expect(Herb).toBeDefined()
  })

  test("Herb export is of instance HerbBackend", () => {
    expect(Herb instanceof HerbBackend).toBeTruthy()
  })

  test("version() returns a string", async () => {
    const version = Herb.version
    expect(typeof version).toBe("string")
    expect(version.length).toBeGreaterThan(0)
  })

  test("parse() can process a simple template", async () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const result = Herb.parse(simpleHtml)
    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.source).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  test("extractRuby() extracts embedded Ruby code", async () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const ruby = Herb.extractRuby(simpleHtml)
    expect(ruby).toBeDefined()
    expect(ruby).toBe('         "Hello World"         ')
  })

  test("extractHTML() extracts HTML content", async () => {
    const simpleHtml = '<div><%= "Hello World" %></div>'
    const html = Herb.extractHTML(simpleHtml)
    expect(html).toBeDefined()
    expect(html).toBe("<div>                    </div>")
  })
})
