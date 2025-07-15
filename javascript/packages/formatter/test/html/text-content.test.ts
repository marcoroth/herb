import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("text content", () => {
    const source = dedent`
      Hello
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      Hello
    `)
  })

  test("text content inside element", () => {
    const source = dedent`
      <div>Hello</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        Hello
      </div>
    `)
  })
})
