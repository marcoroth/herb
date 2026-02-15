import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoTrailingWhitespaceRule } from "../../src/rules/erb-no-trailing-whitespace.js"

describe("erb-no-trailing-whitespace autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes trailing spaces", () => {
    const input = "Hello   "
    const expected = "Hello"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes trailing tab", () => {
    const input = "Hello\t"
    const expected = "Hello"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes all occurrences of trailing whitespace", () => {
    const input = "Hello \nWorld \nClean"
    const expected = "Hello\nWorld\nClean"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes whitespace-only content from blank lines", () => {
    const input = "<div>\n   \n</div>"
    const expected = "<div>\n\n</div>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes trailing whitespace after HTML tags", () => {
    const input = "<div>Hello</div>  \n<p>World</p>"
    const expected = "<div>Hello</div>\n<p>World</p>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles mixed whitespace", () => {
    const input = "Hello \t "
    const expected = "Hello"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify file without trailing whitespace", () => {
    const input = "<div>\n  <p>Hello</p>\n</div>"
    const expected = "<div>\n  <p>Hello</p>\n</div>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles empty file", () => {
    const input = ""
    const expected = ""

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves indentation while removing trailing whitespace", () => {
    const input = "  <div> \n    <p>Hello</p> \n  </div>"
    const expected = "  <div>\n    <p>Hello</p>\n  </div>"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves newlines while removing trailing whitespace", () => {
    const input = "Hello \n\nWorld \n"
    const expected = "Hello\n\nWorld\n"

    const linter = new Linter(Herb, [ERBNoTrailingWhitespaceRule])
    const result = linter.autofix(input, { fileName: "test.html.erb" })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })
})
