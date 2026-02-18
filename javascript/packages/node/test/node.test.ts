import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb, HerbBackend } from "../src/index-esm.mjs"

describe("@herb-tools/node", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("loads the native extension successfully", () => {
    expect(Herb).toBeDefined()
  })

  describe("Arena", () => {
    test("Arena class exists on backend", () => {
      expect(Herb.backend.Arena).toBeDefined()
    })

    test("creating an arena with default size", () => {
      const arena = new Herb.backend.Arena()
      expect(arena).toBeDefined()
      expect(arena.capacity).toBeGreaterThan(0)
    })

    test("creating an arena with custom size", () => {
      const arena = new Herb.backend.Arena({ size: 1024 * 1024 })
      expect(arena).toBeDefined()
      expect(arena.capacity).toBeGreaterThanOrEqual(1024 * 1024)
    })

    test("arena position starts at zero", () => {
      const arena = new Herb.backend.Arena()
      expect(arena.position).toBe(0)
    })

    test("arena position increases after parsing", () => {
      const arena = new Herb.backend.Arena()
      const initialPosition = arena.position

      Herb.backend.parse("<div>hello</div>", { arena })

      expect(arena.position).toBeGreaterThan(initialPosition)
    })

    test("arena can be reused for multiple parse calls", () => {
      const arena = new Herb.backend.Arena()

      const result1 = Herb.backend.parse("<div>first</div>", { arena })
      const positionAfterFirst = arena.position

      const result2 = Herb.backend.parse("<span>second</span>", { arena })
      const positionAfterSecond = arena.position

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(positionAfterSecond).toBeGreaterThan(positionAfterFirst)
    })

    test("arena reset returns position to zero", () => {
      const arena = new Herb.backend.Arena()

      Herb.backend.parse("<div>hello</div>", { arena })
      expect(arena.position).toBeGreaterThan(0)

      arena.reset()
      expect(arena.position).toBe(0)
    })

    test("arena can be reused after reset", () => {
      const arena = new Herb.backend.Arena()

      const result1 = Herb.backend.parse("<div>first</div>", { arena })
      arena.reset()

      const result2 = Herb.backend.parse("<span>second</span>", { arena })

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
    })

    test("multiple arenas can be used independently", () => {
      const arena1 = new Herb.backend.Arena()
      const arena2 = new Herb.backend.Arena()

      Herb.backend.parse("<div>first</div>", { arena: arena1 })
      const position1 = arena1.position

      Herb.backend.parse("<span>second</span>", { arena: arena2 })
      const position2 = arena2.position

      expect(position1).toBeGreaterThan(0)
      expect(position2).toBeGreaterThan(0)
      expect(arena1.position).toBe(position1)
    })

    test("parsing many templates with shared arena", () => {
      const arena = new Herb.backend.Arena()

      for (let i = 0; i < 100; i++) {
        const result = Herb.backend.parse(`<div>template ${i}</div>`, { arena })
        expect(result).toBeDefined()
      }

      expect(arena.position).toBeGreaterThan(0)
    })

    test("arena reset allows reuse for batch processing", () => {
      const arena = new Herb.backend.Arena()

      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 10; i++) {
          const result = Herb.backend.parse(`<div>batch ${batch} item ${i}</div>`, { arena })
          expect(result).toBeDefined()
        }
        arena.reset()
        expect(arena.position).toBe(0)
      }
    })

    test("arena free releases resources", () => {
      const arena = new Herb.backend.Arena()
      Herb.backend.parse("<div>hello</div>", { arena })
      arena.free()
    })
  })

  test("Herb export is of instance HerbBackend", () => {
    expect(Herb instanceof HerbBackend).toBeTruthy()
  })

  test("version() returns a string", async () => {
    const version = Herb.version
    expect(typeof version).toBe("string")
    expect(version).toBe("@herb-tools/node@0.8.10, @herb-tools/core@0.8.10, libprism@1.9.0, libherb@0.8.10 (Node.js C++ native extension)")
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
