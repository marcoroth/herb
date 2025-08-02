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

  test("mixed inline content stays inline", () => {
    const source = dedent`
      <p>hello <b>bold</b> world</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>hello <b>bold</b> world</p>
    `)
  })

  test("simple mixed content with multiple elements stays inline", () => {
    const source = dedent`
      <p>A <b>bold</b> and <i>italic</i> text</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>A <b>bold</b> and <i>italic</i> text</p>
    `)
  })

  test("any tag can be inline when content is simple", () => {
    const source = dedent`
      <div>Simple <section>nested</section> content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        Simple
        <section>nested</section>
        content
      </div>
    `)
  })

  test("mixed content with nested elements splits when too deep", () => {
    const source = dedent`
      <p>hello <div>complex <span>nested</span> content</div> world</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        hello
        <div>complex <span>nested</span> content</div>
        world
      </p>
    `)
  })

  test("single level nesting stays inline", () => {
    const source = dedent`
      <h1><b>hello</b></h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1><b>hello</b></h1>
    `)
  })

  test("deep nesting splits across lines", () => {
    const source = dedent`
      <h1><b><i>hello</i></b></h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>
        <b>
          <i>hello</i>
        </b>
      </h1>
    `)
  })
})
