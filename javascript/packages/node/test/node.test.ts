import { describe, test, expect, beforeAll } from "vitest"
import { Herb, HerbBackend } from "../src/index-esm.mjs"

describe("@herb-tools/node", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("loads the native extension successfully", () => {
    expect(Herb).toBeDefined()
  })

  test("Herb export is of instance HerbBackend", () => {
    expect(Herb instanceof HerbBackend).toBeTruthy()
  })

  test("version() returns a string", async () => {
    const version = Herb.version
    expect(typeof version).toBe("string")
    expect(version).toBe("@herb-tools/node@0.4.0, @herb-tools/core@0.4.0, libprism@1.4.0, libherb@0.4.0 (Node.js C++ native extension)")
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

  test("parse and transform erb if node", async () => {
    const erb = "<% if true %>true<% end %>"
    const result = Herb.parse(erb)
    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.value.inspect()).toContain(
      "@ ERBIfNode (location: (1:0)-(1:26))",
    )
    expect(result.value.inspect()).toContain(
      "@ ERBEndNode (location: (1:17)-(1:26))",
    )
  })
})
