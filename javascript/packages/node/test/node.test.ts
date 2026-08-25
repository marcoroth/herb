import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb, HerbBackend } from "../src/index.js"

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
    expect(version).toBe("@herb-tools/node@0.10.3, @herb-tools/core@0.10.3, libprism@1.9.0, libherb@0.10.3 (Node.js C++ native extension)")
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
    expect(ruby).toBe('         "Hello World"  ;      ')
  })

  test("extractRuby() with semicolons: false", async () => {
    const source = "<% x = 1 %> <% y = 2 %>"
    const ruby = Herb.extractRuby(source, { semicolons: false })
    expect(ruby).toBe("   x = 1       y = 2   ")
  })

  test("extractRuby() with comments: true", async () => {
    const source = "<%# comment %>\n<% code %>"
    const ruby = Herb.extractRuby(source, { comments: true })
    expect(ruby).toBe("  # comment   \n   code  ;")
  })

  test("extractRuby() with preserve_positions: false", async () => {
    const source = "<% x = 1 %> <% y = 2 %>"
    const ruby = Herb.extractRuby(source, { preserve_positions: false })
    expect(ruby).toBe(" x = 1 \n y = 2 ")
  })

  test("extractRuby() with preserve_positions: false and comments: true", async () => {
    const source = "<%# comment %><%= something %>"
    const ruby = Herb.extractRuby(source, { preserve_positions: false, comments: true })
    expect(ruby).toBe("# comment \n something ")
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

  test("parse() with analyze: true (default) transforms ERB nodes", async () => {
    const erb = "<% if true %>true<% end %>"
    const result = Herb.parse(erb)
    expect(result.value.inspect()).toContain("@ ERBIfNode")
    expect(result.value.inspect()).not.toContain("@ ERBContentNode")
  })

  test("parse() with analyze: false skips ERB node transformation", async () => {
    const erb = "<% if true %>true<% end %>"
    const result = Herb.parse(erb, { analyze: false })
    expect(result.value.inspect()).toContain("@ ERBContentNode")
    expect(result.value.inspect()).not.toContain("@ ERBIfNode")
  })

  test("parse() without track_whitespace option ignores whitespace", async () => {
    const htmlWithWhitespace = '<div     class="example">content</div>'
    const result = Herb.parse(htmlWithWhitespace)

    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value.inspect()).not.toContain("@ WhitespaceNode")
  })

  test("parse() with track_whitespace: false ignores whitespace", async () => {
    const htmlWithWhitespace = '<div     class="example">content</div>'
    const result = Herb.parse(htmlWithWhitespace, { track_whitespace: false })

    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value.inspect()).not.toContain("@ WhitespaceNode")
  })

  test("parse() with track_whitespace: true tracks whitespace", async () => {
    const htmlWithWhitespace = '<div     class="example">content</div>'
    const result = Herb.parse(htmlWithWhitespace, { track_whitespace: true })

    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value.inspect()).toContain("@ WhitespaceNode")
    expect(result.value.inspect()).toContain('"     "')
  })

  test("parse() with track_whitespace tracks whitespace in close tags", async () => {
    const htmlWithWhitespace = '<div>content</div   >'
    const result = Herb.parse(htmlWithWhitespace, { track_whitespace: true })

    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value.inspect()).toContain("@ WhitespaceNode")
    expect(result.value.inspect()).toContain('"   "')
  })

  test("parse() reports the total error count", () => {
    expect(Herb.parse('<div class="example">content</div>').errorCount).toBe(0)
    expect(Herb.parse("<div>").errorCount).toBe(1)
    expect(Herb.parse("<% if condition without end %>").errorCount).toBe(1)
  })

  test("the error count matches the errors attached to the tree", () => {
    for (const source of ["<div>", "<div><span>hello</div>", "<% if x %>", "</div>".repeat(30)]) {
      const result = Herb.parse(source)

      expect(result.errorCount).toBe(result.value.recursiveErrors().length)
      expect(result.errorCount).toBe(result.recursiveErrors().length)
    }
  })

  test("a zero error count skips the recursive walk without losing errors", () => {
    const result = Herb.parse("<div>ok</div>")

    expect(result.errorCount).toBe(0)
    expect(result.recursiveErrors()).toHaveLength(0)
    expect(result.failed).toBe(false)
  })

  test("the error count respects max_errors", () => {
    expect(Herb.parse("<div>".repeat(1000)).errorCount).toBe(25)
    expect(Herb.parse("<div>".repeat(1000), { max_errors: 5 }).errorCount).toBe(5)
  })

  test("parse() tracks locations by default", () => {
    const result = Herb.parse('<div class="example">content</div>')
    const element = result.value.children[0] as any

    expect(result.options.track_locations).toBe(true)
    expect(result.value.location).not.toBeNull()
    expect(element.location).not.toBeNull()
    expect(element.open_tag.tag_name.location).not.toBeNull()
    expect(element.open_tag.tag_name.range).not.toBeNull()
  })

  test("parse() with track_locations: false omits locations and ranges", () => {
    const result = Herb.parse('<div class="example">content</div>', { track_locations: false })
    const element = result.value.children[0] as any

    expect(result.options.track_locations).toBe(false)
    expect(result.value.location).toBeNull()
    expect(element.location).toBeNull()
    expect(element.open_tag.tag_name.location).toBeNull()
    expect(element.open_tag.tag_name.range).toBeNull()
  })

  test("parse() with track_locations: false keeps the tree shape intact", () => {
    const source = '<div class="example">content</div>'
    const withLocations = Herb.parse(source)
    const withoutLocations = Herb.parse(source, { track_locations: false })

    expect(withoutLocations.value.type).toBe(withLocations.value.type)
    expect(withoutLocations.value.children.map((node) => node.type)).toEqual(
      withLocations.value.children.map((node) => node.type),
    )
    expect(withoutLocations.errors).toHaveLength(withLocations.errors.length)
  })

  test("lex() keeps token locations when parse locations are disabled", () => {
    const result = Herb.lex('<div class="example">content</div>')

    expect(result.value.tokens[0].location).not.toBeNull()
    expect(result.value.tokens[0].range).not.toBeNull()
  })

  test("parses then_keyword for when clause", () => {
    const content = dedent`
      <% case value %>
      <% when String then "string" %>
      <% end %>
    `

    const result = Herb.parse(content)
    const caseNode = result.value.children[0] as any
    const whenNode = caseNode.conditions[0]

    expect(whenNode.then_keyword).toBeDefined()
    expect(whenNode.then_keyword.start.line).toBe(2)
    expect(whenNode.then_keyword.start.column).toBe(15)
    expect(whenNode.then_keyword.end.line).toBe(2)
    expect(whenNode.then_keyword.end.column).toBe(19)
  })
})
