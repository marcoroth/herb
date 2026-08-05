import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ActionViewNoUnnecessaryHTMLSafeRule } from "../../src/rules/actionview-no-unnecessary-html-safe.js"

describe("actionview-no-unnecessary-html-safe autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const autofix = (input: string) => new Linter(Herb, [ActionViewNoUnnecessaryHTMLSafeRule]).autofix(input)

  test("fixes a String literal marked as HTML-safe in attribute position", () => {
    const result = autofix(`<div <%= 'style="display: none;"'.html_safe %>></div>`)

    expect(result.source).toBe(`<div style="display: none;"></div>`)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes a String literal marked as HTML-safe in content position", () => {
    const result = autofix(`<p><%= "<strong>Sale</strong>".html_safe %></p>`)

    expect(result.source).toBe(`<p><strong>Sale</strong></p>`)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes a String literal marked as HTML-safe in an attribute value", () => {
    const result = autofix(`<div class="<%= 'btn btn-primary'.html_safe %>"></div>`)

    expect(result.source).toBe(`<div class="btn btn-primary"></div>`)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes a String literal with an HTML entity", () => {
    const result = autofix(`<%= "&copy; 2026".html_safe %>`)

    expect(result.source).toBe(`&copy; 2026`)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes an empty String literal", () => {
    const result = autofix(`<%= "".html_safe %>`)

    expect(result.source).toBe(``)
    expect(result.fixed).toHaveLength(1)
  })

  test("unescapes escape sequences in the String literal", () => {
    const result = autofix(`<%= "<span title=\\"Sale\\">Sale</span>".html_safe %>`)

    expect(result.source).toBe(`<span title="Sale">Sale</span>`)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes every occurrence in a template", () => {
    const input = dedent`
      <div <%= 'style="display: none;"'.html_safe %>>
        <p><%= "<strong>Sale</strong>".html_safe %></p>
      </div>
    `

    const expected = dedent`
      <div style="display: none;">
        <p><strong>Sale</strong></p>
      </div>
    `

    const result = autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("does not fix a String literal that would introduce an ERB tag", () => {
    const input = `<%= "\\x3C%= evil %\\x3E".html_safe %>`

    const result = autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })
})
