import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBRequireTrailingNewlineRule } from "../../src/rules/erb-require-trailing-newline.js"

describe("erb-require-trailing-newline autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("adds trailing newline to file without one", () => {
    const input = '<div>Hello World</div>'
    const expected = '<div>Hello World</div>\n'

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not add newline if already present", () => {
    const input = '<div>Hello World</div>\n'
    const expected = '<div>Hello World</div>\n'

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("handles multi-line files", () => {
    const input = dedent`
      <div>
        <span>Hello</span>
      </div>`

    const expected = dedent`
      <div>
        <span>Hello</span>
      </div>
    ` + '\n'

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles file with ERB tags", () => {
    const input = '<div><%= content %></div>'
    const expected = '<div><%= content %></div>\n'

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles empty file", () => {
    const input = ''
    const expected = ''

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("removes redundant trailing newline", () => {
    const input = '<div>Hello</div>\n\n'
    const expected = '<div>Hello</div>\n'

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes redundant trailing newlines", () => {
    const input = '<div>Hello</div>\n\n\n\n\n\n'
    const expected = '<div>Hello</div>\n'

    const linter = new Linter(Herb, [ERBRequireTrailingNewlineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })
})
