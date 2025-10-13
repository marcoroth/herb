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

  test("formats headings", () => {
    const source = dedent`
      <h1>Heading Level 1</h1>
      <h2>Heading Level 2</h2>
      <h3>Heading Level 3</h3>
      <h4>Heading Level 4</h4>
      <h5>Heading Level 5</h5>
      <h6>Heading Level 6</h6>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>Heading Level 1</h1>

      <h2>Heading Level 2</h2>

      <h3>Heading Level 3</h3>

      <h4>Heading Level 4</h4>

      <h5>Heading Level 5</h5>

      <h6>Heading Level 6</h6>
    `)
  })
})
