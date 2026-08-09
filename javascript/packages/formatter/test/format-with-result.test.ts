import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"

import dedent from "dedent"

let formatter: Formatter

describe("Formatter#formatWithResult", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })
  })

  test("reports a formatted document as not skipped", () => {
    const source = dedent`
      <div>
      <span>hello</span>
      </div>
    `

    const result = formatter.formatWithResult(source)

    expect(result.skipped).toBeNull()
    expect(result.errorCount).toBe(0)
    expect(result.output).not.toEqual(source)
  })

  test("reports an already formatted document as not skipped", () => {
    const source = dedent`
      <div>
        <span>hello</span>
      </div>
    `

    const result = formatter.formatWithResult(source)

    expect(result.skipped).toBeNull()
  })

  test("reports parse errors and returns the source untouched", () => {
    const source = '<div><span>x\n<% if %>\n</div>\n'

    const result = formatter.formatWithResult(source)

    expect(result.skipped).toBe("parse-errors")
    expect(result.errorCount).toBeGreaterThan(0)
    expect(result.output).toBe(source)
  })

  test("reports the herb:formatter ignore directive", () => {
    const source = '<%# herb:formatter ignore %>\n<div>   messy   </div>\n'

    const result = formatter.formatWithResult(source)

    expect(result.skipped).toBe("ignore-directive")
    expect(result.output).toBe(source)
  })

  test("format() stays a plain string and matches formatWithResult output", () => {
    const source = dedent`
      <div>
      <span>hello</span>
      </div>
    `

    expect(formatter.format(source)).toBe(formatter.formatWithResult(source).output)
  })

  test("format() still returns the source unchanged for unparseable input", () => {
    const source = '<div><span>x\n<% if %>\n</div>\n'

    expect(formatter.format(source)).toBe(source)
  })
})
