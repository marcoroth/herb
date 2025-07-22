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
      <div>Hello</div>
    `)
  })

  test("short text content stays inline", () => {
    const source = dedent`
      <h1>hello</h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>hello</h1>
    `)
  })

  test("long text content splits across lines", () => {
    const source = dedent`
      <h1>This is a very long text that should probably be split across multiple lines because it exceeds the max line length</h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>
        This is a very long text that should probably be split across multiple lines
        because it exceeds the max line length
      </h1>
    `)
  })

  test("multiline text content splits across lines", () => {
    const source = dedent`
      <div>Multi
      line</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        Multi line
      </div>
    `)
  })
})
