import { describe, test, expect, beforeAll } from "vitest"
import { Herb, HerbBackend } from "../src"

describe("@herb-tools/browser", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("loads wasm successfully", () => {
    expect(Herb).toBeDefined()
  })

  describe("Arena", () => {
    test("createArena returns an Arena", () => {
      const arena = Herb.createArena()
      expect(arena).toBeDefined()
      expect(arena.capacity).toBeGreaterThan(0)
      arena.free()
    })

    test("creating an arena with custom size", () => {
      const arena = Herb.createArena({ size: 1024 * 1024 })
      expect(arena).toBeDefined()
      expect(arena.capacity).toBeGreaterThanOrEqual(1024 * 1024)
      arena.free()
    })

    test("arena position starts at zero", () => {
      const arena = Herb.createArena()
      expect(arena.position).toBe(0)
      arena.free()
    })

    test("arena position increases after parsing", () => {
      const arena = Herb.createArena()
      const initialPosition = arena.position

      Herb.parse("<div>hello</div>", { arena })

      expect(arena.position).toBeGreaterThan(initialPosition)
      arena.free()
    })

    test("arena can be reused for multiple parse calls", () => {
      const arena = Herb.createArena()

      const result1 = Herb.parse("<div>first</div>", { arena })
      const positionAfterFirst = arena.position

      const result2 = Herb.parse("<span>second</span>", { arena })
      const positionAfterSecond = arena.position

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(positionAfterSecond).toBeGreaterThan(positionAfterFirst)
      arena.free()
    })

    test("arena reset returns position to zero", () => {
      const arena = Herb.createArena()

      Herb.parse("<div>hello</div>", { arena })
      expect(arena.position).toBeGreaterThan(0)

      arena.reset()
      expect(arena.position).toBe(0)
      arena.free()
    })

    test("arena can be reused after reset", () => {
      const arena = Herb.createArena()

      const result1 = Herb.parse("<div>first</div>", { arena })
      arena.reset()

      const result2 = Herb.parse("<span>second</span>", { arena })

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      arena.free()
    })

    test("multiple arenas can be used independently", () => {
      const arena1 = Herb.createArena()
      const arena2 = Herb.createArena()

      Herb.parse("<div>first</div>", { arena: arena1 })
      const position1 = arena1.position

      Herb.parse("<span>second</span>", { arena: arena2 })
      const position2 = arena2.position

      expect(position1).toBeGreaterThan(0)
      expect(position2).toBeGreaterThan(0)
      expect(arena1.position).toBe(position1)

      arena1.free()
      arena2.free()
    })

    test("parsing many templates with shared arena", () => {
      const arena = Herb.createArena()

      for (let i = 0; i < 100; i++) {
        const result = Herb.parse(`<div>template ${i}</div>`, { arena })
        expect(result).toBeDefined()
      }

      expect(arena.position).toBeGreaterThan(0)
      arena.free()
    })

    test("arena reset allows reuse for batch processing", () => {
      const arena = Herb.createArena()

      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 10; i++) {
          const result = Herb.parse(`<div>batch ${batch} item ${i}</div>`, { arena })
          expect(result).toBeDefined()
        }
        arena.reset()
        expect(arena.position).toBe(0)
      }

      arena.free()
    })

    test("arena free releases resources", () => {
      const arena = Herb.createArena()
      Herb.parse("<div>hello</div>", { arena })
      arena.free()
    })

    test("arena works with lex", () => {
      const arena = Herb.createArena()

      const result = Herb.lex("<div>hello</div>", { arena })

      expect(result).toBeDefined()
      expect(result.value.tokens.length).toBeGreaterThan(0)
      arena.free()
    })

    test("arena can be reused for multiple lex calls", () => {
      const arena = Herb.createArena()

      const result1 = Herb.lex("<div>first</div>", { arena })
      const result2 = Herb.lex("<span>second</span>", { arena })

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(result1.value.tokens.length).toBeGreaterThan(0)
      expect(result2.value.tokens.length).toBeGreaterThan(0)
      arena.free()
    })

    test("arena can be used for both parse and lex", () => {
      const arena = Herb.createArena()

      const parseResult = Herb.parse("<div>parsed</div>", { arena })
      const lexResult = Herb.lex("<span>lexed</span>", { arena })

      expect(parseResult).toBeDefined()
      expect(lexResult).toBeDefined()
      expect(parseResult.value).toBeDefined()
      expect(lexResult.value.tokens.length).toBeGreaterThan(0)
      arena.free()
    })
  })

  test("Herb export is of instance HerbBackend", () => {
    expect(Herb instanceof HerbBackend).toBeTruthy()
  })

  test("version() returns a string", async () => {
    const version = Herb.version
    expect(typeof version).toBe("string")
    expect(version).toBe("@herb-tools/browser@0.8.10, @herb-tools/core@0.8.10, libprism@1.9.0, libherb@0.8.10 (WebAssembly)")
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
})
