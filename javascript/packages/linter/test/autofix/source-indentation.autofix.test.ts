import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../../src/linter.js"

import { SourceIndentationRule } from "../../src/rules/source-indentation.js"

describe("source-indentation autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("replaces tab indentation with spaces", () => {
    const input = "\tthis is a line\n\tanother line\n"
    const expected = "  this is a line\n  another line\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("replaces multiple tab indentation with spaces", () => {
    const input = "\t\tthis is a line\n"
    const expected = "    this is a line\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("replaces tabs in mixed indentation", () => {
    const input = "  \t    this is a line\n  \t  another line\n"
    const expected = "        this is a line\n      another line\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("ignores space-only indentation", () => {
    const input = "   this is a line\n   another line\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("ignores lines without indentation", () => {
    const input = "this is a line\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("ignores tabs in the middle of a line", () => {
    const input = "hello\tworld\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles HTML content with tab indentation", () => {
    const input = "<div>\n\t<p>hello</p>\n</div>\n"
    const expected = "<div>\n  <p>hello</p>\n</div>\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("uses custom indentWidth from autofix context", () => {
    const input = "\tthis is a line\n\t\tindented twice\n"
    const expected = "    this is a line\n        indented twice\n"

    const linter = new Linter(Herb, [SourceIndentationRule])
    const result = linter.autofix(input, { indentWidth: 4 })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("defaults to indentWidth from formatter config", () => {
    const input = "\tthis is a line\n\t\tindented twice\n"
    const expected = "    this is a line\n        indented twice\n"

    const config = Config.fromObject({
      formatter: {
        indentWidth: 4
      },
      linter: {
        rules: {
          "source-indentation": { enabled: true }
        }
      }
    })

    const linter = Linter.from(Herb, config)
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })
})
