import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"

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

  test("respects indentWidth option", () => {
    const source = dedent`
      <div><b><i>Hello</i></b> <%= "World" %></div>
    `
    const result = formatter.format(source, { indentWidth: 4 })
    expect(result).toEqual(dedent`
      <div>
          <b>
              <i>Hello</i>
          </b>
          <%= "World" %>
      </div>
    `)
  })

  test("wraps long text content at maxLineLength threshold", () => {
    const formatter = new Formatter(Herb, { maxLineLength: 40 })
    const longText =
      'This is a very long line of text that should be broken into multiple lines by the formatter based on the maxLineLength option.'
    const source = dedent`
      <p>${longText}</p>
    `
    expect(formatter.format(source)).toEqual(dedent`
      <p>
        This is a very long line of text that
        should be broken into multiple lines
        by the formatter based on the
        maxLineLength option.
      </p>
    `)

    expect(formatter.format(source, { maxLineLength: 80 })).toEqual(dedent`
      <p>
        This is a very long line of text that should be broken into multiple lines by
        the formatter based on the maxLineLength option.
      </p>
    `)
  })
})
