import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node"
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

  test("does not wrap single attribute", () => {
    const source = dedent`
      <div class="foo"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo"></div>
    `)
  })

  test("wraps multiple attributes correctly", () => {
    const source = dedent`
      <div class="foo" id="bar"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        class="foo"
        id="bar"
      ></div>
    `)
  })

  test("formats tags with empty attribute values", () => {
    const source = dedent`
      <div id=""></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        id=""
      ></div>
    `)
  })
})
