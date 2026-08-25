import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoByteOrderMarkRule } from "../../src/rules/erb-no-byte-order-mark.js"
import { BYTE_ORDER_MARK as BOM } from "@herb-tools/core"

describe("erb-no-byte-order-mark autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes a leading byte order mark", () => {
    const linter = new Linter(Herb, [ERBNoByteOrderMarkRule])
    const result = linter.autofix(`${BOM}<div>hello</div>\n`, { fileName: "test.html.erb" })

    expect(result.source).toBe("<div>hello</div>\n")
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("leaves the rest of the document untouched", () => {
    const linter = new Linter(Herb, [ERBNoByteOrderMarkRule])
    const result = linter.autofix(`${BOM}<div>a${BOM}b</div>\n`, { fileName: "test.html.erb" })

    expect(result.source).toBe(`<div>a${BOM}b</div>\n`)
    expect(result.fixed).toHaveLength(1)
  })

  test("removes only one byte order mark per pass", () => {
    const linter = new Linter(Herb, [ERBNoByteOrderMarkRule])
    const result = linter.autofix(`${BOM}${BOM}<div>hello</div>\n`, { fileName: "test.html.erb" })

    expect(result.source).toBe(`${BOM}<div>hello</div>\n`)
    expect(result.fixed).toHaveLength(1)
  })

  test("does not modify a document without a byte order mark", () => {
    const linter = new Linter(Herb, [ERBNoByteOrderMarkRule])
    const result = linter.autofix("<div>hello</div>\n", { fileName: "test.html.erb" })

    expect(result.source).toBe("<div>hello</div>\n")
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
