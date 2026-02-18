import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb, HerbBackend } from "../src"

import type { ERBCaseNode, ERBWhenNode } from "../src"

describe("@herb-tools/node-wasm", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("loads wasm successfully", () => {
    expect(Herb).toBeDefined()
  })

  describe("Arena", () => {
    test("createArena function exists on backend", () => {
      expect(Herb.backend.createArena).toBeDefined()
      expect(typeof Herb.backend.createArena).toBe("function")
    })

    test("arena functions exist on backend", () => {
      expect(Herb.backend.resetArena).toBeDefined()
      expect(Herb.backend.freeArena).toBeDefined()
      expect(Herb.backend.arenaPosition).toBeDefined()
      expect(Herb.backend.arenaCapacity).toBeDefined()
    })

    test("creating an arena returns a valid id", () => {
      const arenaId = Herb.backend.createArena(0)
      expect(arenaId).toBeGreaterThan(0)
      Herb.backend.freeArena(arenaId)
    })

    test("creating an arena with custom size", () => {
      const arenaId = Herb.backend.createArena(1024 * 1024)
      expect(arenaId).toBeGreaterThan(0)
      expect(Herb.backend.arenaCapacity(arenaId)).toBeGreaterThanOrEqual(1024 * 1024)
      Herb.backend.freeArena(arenaId)
    })

    test("arena position starts at zero", () => {
      const arenaId = Herb.backend.createArena(0)
      expect(Herb.backend.arenaPosition(arenaId)).toBe(0)
      Herb.backend.freeArena(arenaId)
    })

    test("arena position increases after parsing", () => {
      const arenaId = Herb.backend.createArena(0)
      const initialPosition = Herb.backend.arenaPosition(arenaId)

      Herb.backend.parse("<div>hello</div>", { arenaId })

      expect(Herb.backend.arenaPosition(arenaId)).toBeGreaterThan(initialPosition)
      Herb.backend.freeArena(arenaId)
    })

    test("arena can be reused for multiple parse calls", () => {
      const arenaId = Herb.backend.createArena(0)

      const result1 = Herb.backend.parse("<div>first</div>", { arenaId })
      const positionAfterFirst = Herb.backend.arenaPosition(arenaId)

      const result2 = Herb.backend.parse("<span>second</span>", { arenaId })
      const positionAfterSecond = Herb.backend.arenaPosition(arenaId)

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(positionAfterSecond).toBeGreaterThan(positionAfterFirst)
      Herb.backend.freeArena(arenaId)
    })

    test("arena reset returns position to zero", () => {
      const arenaId = Herb.backend.createArena(0)

      Herb.backend.parse("<div>hello</div>", { arenaId })
      expect(Herb.backend.arenaPosition(arenaId)).toBeGreaterThan(0)

      Herb.backend.resetArena(arenaId)
      expect(Herb.backend.arenaPosition(arenaId)).toBe(0)
      Herb.backend.freeArena(arenaId)
    })

    test("arena can be reused after reset", () => {
      const arenaId = Herb.backend.createArena(0)

      const result1 = Herb.backend.parse("<div>first</div>", { arenaId })
      Herb.backend.resetArena(arenaId)

      const result2 = Herb.backend.parse("<span>second</span>", { arenaId })

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      Herb.backend.freeArena(arenaId)
    })

    test("multiple arenas can be used independently", () => {
      const arenaId1 = Herb.backend.createArena(0)
      const arenaId2 = Herb.backend.createArena(0)

      Herb.backend.parse("<div>first</div>", { arenaId: arenaId1 })
      const position1 = Herb.backend.arenaPosition(arenaId1)

      Herb.backend.parse("<span>second</span>", { arenaId: arenaId2 })
      const position2 = Herb.backend.arenaPosition(arenaId2)

      expect(position1).toBeGreaterThan(0)
      expect(position2).toBeGreaterThan(0)
      expect(Herb.backend.arenaPosition(arenaId1)).toBe(position1)

      Herb.backend.freeArena(arenaId1)
      Herb.backend.freeArena(arenaId2)
    })

    test("parsing many templates with shared arena", () => {
      const arenaId = Herb.backend.createArena(0)

      for (let i = 0; i < 100; i++) {
        const result = Herb.backend.parse(`<div>template ${i}</div>`, { arenaId })
        expect(result).toBeDefined()
      }

      expect(Herb.backend.arenaPosition(arenaId)).toBeGreaterThan(0)
      Herb.backend.freeArena(arenaId)
    })

    test("arena reset allows reuse for batch processing", () => {
      const arenaId = Herb.backend.createArena(0)

      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 10; i++) {
          const result = Herb.backend.parse(`<div>batch ${batch} item ${i}</div>`, { arenaId })
          expect(result).toBeDefined()
        }
        Herb.backend.resetArena(arenaId)
        expect(Herb.backend.arenaPosition(arenaId)).toBe(0)
      }

      Herb.backend.freeArena(arenaId)
    })

    test("invalid arena id returns -1 for position", () => {
      expect(Herb.backend.arenaPosition(99999)).toBe(-1)
    })

    test("invalid arena id returns -1 for capacity", () => {
      expect(Herb.backend.arenaCapacity(99999)).toBe(-1)
    })
  })

  test("Herb export is of instance HerbBackend", () => {
    expect(Herb instanceof HerbBackend).toBeTruthy()
  })

  test("version() returns a string", async () => {
    const version = Herb.version
    expect(typeof version).toBe("string")
    expect(version).toBe("@herb-tools/node-wasm@0.8.10, @herb-tools/core@0.8.10, libprism@1.9.0, libherb@0.8.10 (WebAssembly)")
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
    const caseNode = result.value.children[0] as ERBCaseNode
    const whenNode = caseNode.conditions[0] as ERBWhenNode

    expect(whenNode.then_keyword.start.line).toBe(2)
    expect(whenNode.then_keyword.start.column).toBe(15)
    expect(whenNode.then_keyword.end.line).toBe(2)
    expect(whenNode.then_keyword.end.column).toBe(19)
  })
})
