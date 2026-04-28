import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBPreferDirectOutputRule } from "../../src/rules/erb-prefer-direct-output.js"

describe("erb-prefer-direct-output autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("fixes plain double-quoted string literal", () => {
    const input = '<%= "Title" %>'
    const expected = "Title"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes plain single-quoted string literal", () => {
    const input = "<%= 'Title' %>"
    const expected = "Title"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes empty string literal", () => {
    const input = '<%= "" %>'
    const expected = ""

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string with single expression", () => {
    const input = '<%= "#{key}" %>'
    const expected = "<%= key %>"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string with multiple expressions", () => {
    const input = '<%= "#{key} (#{participants.size})" %>'
    const expected = "<%= key %> (<%= participants.size %>)"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string with multiple expressions and no space", () => {
    const input = '<%= "#{key}#{value}" %>'
    const expected = "<%= key %><%= value %>"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string with leading text", () => {
    const input = '<%= "Hello #{name}" %>'
    const expected = "Hello <%= name %>"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string with trailing text", () => {
    const input = '<%= "#{name}!" %>'
    const expected = "<%= name %>!"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("preserves raw output tag type", () => {
    const input = '<%== "#{key}" %>'
    const expected = "<%== key %>"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes string literal inside element", () => {
    const input = '<h1><%= "Title" %></h1>'
    const expected = "<h1>Title</h1>"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes multiple offenses", () => {
    const input = dedent`
      <div>
        <%= "Hello" %>
        <%= "World" %>
      </div>
    `

    const expected = dedent`
      <div>
        Hello
        World
      </div>
    `

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes interpolated string inside element", () => {
    const input = '<span><%= "#{count} items" %></span>'
    const expected = "<span><%= count %> items</span>"

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
