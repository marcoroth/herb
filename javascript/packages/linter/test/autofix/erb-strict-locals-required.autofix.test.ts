import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBStrictLocalsRequiredRule } from "../../src/rules/erb-strict-locals-required.js"

describe("erb-strict-locals-required autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("does not apply unsafe fix by default", () => {
    const input = '<div>Content</div>'

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_partial.html.erb' })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("adds empty strict locals declaration with --fix-unsafely", () => {
    const input = '<div>Content</div>'
    const expected = '<%# locals: () %>\n\n<div>Content</div>'

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_partial.html.erb' }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify files that already have strict locals", () => {
    const input = dedent`
      <%# locals: (user:) %>
      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_partial.html.erb' }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify non-partial files", () => {
    const input = '<div>Content</div>'

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: 'show.html.erb' }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles multi-line files", () => {
    const input = dedent`
      <div class="card">
        <h2>Title</h2>
        <p>Content</p>
      </div>
    `

    const expected = `<%# locals: () %>\n\n${input}`

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_card.html.erb' }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
