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

  test("fixes interpolated string with multiple expressions when preceded by a multi-byte character", () => {
    const input = dedent`
      <%# é %>
      <%= "#{object.attribute}(#{data})" %>
    `

    const expected = dedent`
      <%# é %>
      <%= object.attribute %>(<%= data %>)
    `

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string with multiple expressions when preceded by an emoji", () => {
    const input = dedent`
      <%# 😀 %>
      <%= "#{object.attribute}(#{data})" %>
    `

    const expected = dedent`
      <%# 😀 %>
      <%= object.attribute %>(<%= data %>)
    `

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string when the multi-byte characters surround the interpolation", () => {
    const input = '<%= "→ #{label} ←" %>'
    const expected = '→ <%= label %> ←'

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string when a multi-byte character appears in earlier markup (#1855)", () => {
    const input = dedent`
      <p>é</p>
      <p><%= "#{@organisation.slug}.#{AppHost.base_host}" %></p>
    `

    const expected = dedent`
      <p>é</p>
      <p><%= @organisation.slug %>.<%= AppHost.base_host %></p>
    `

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes interpolated string when a three-byte character appears in an earlier comment (#1855)", () => {
    const input = dedent`
      <%# — %>
      <strong><%= "#{@organisation.slug}.#{AppHost.base_host}" %></strong>
    `

    const expected = dedent`
      <%# — %>
      <strong><%= @organisation.slug %>.<%= AppHost.base_host %></strong>
    `

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes a later offence when an earlier one contains a multi-byte character (#1761)", () => {
    const input = '<%= "#{first}  – " %>\n<%= "#{second} - " %>'
    const expected = '<%= first %>  – \n<%= second %> - '

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("does not fix an interpolated string in an unquoted attribute value", () => {
    const input = '<div id=<%= "#{a}_#{b}" %>>y</div>'

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not fix a string literal in an unquoted attribute value", () => {
    const input = '<button data-target=<%= "##{t}" %>>y</button>'

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not fix text that would be parsed as markup", () => {
    const input = '<p><%= "#{a} <request body> -- #{b}" %></p>'

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not fix text that would stop being escaped", () => {
    const input = '<p><%= "a & b" %></p>'

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not fix text containing the quote that encloses the attribute value", () => {
    const input = `<div title="<%= "say \\"hi\\"" %>">y</div>`

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes text containing a quote the enclosing attribute value does not use", () => {
    const input = `<div title="<%= "it's" %>">y</div>`
    const expected = `<div title="it's">y</div>`

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes an interpolated string in a quoted attribute value", () => {
    const input = '<div id="<%= "#{a}_#{b}" %>">y</div>'
    const expected = '<div id="<%= a %>_<%= b %>">y</div>'

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes every offence following a multi-byte character (#1761)", () => {
    const input = dedent`
      <%= "#{a} – ok" %>
      <%= "#{b} - ok" %>
      <%= "#{c} - ok" %>
    `

    const expected = dedent`
      <%= a %> – ok
      <%= b %> - ok
      <%= c %> - ok
    `

    const linter = new Linter(Herb, [ERBPreferDirectOutputRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
  })
})
