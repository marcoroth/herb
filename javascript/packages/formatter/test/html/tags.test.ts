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

  test("HTML tag with missing closing", () => {
    const source = dedent`
      <div
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
    `)
  })

  test("HTML tag with mismatched closing tag", () => {
    const source = dedent`
      <form></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <form></div>
    `)
  })

  test("HTML tag with attributes", () => {
    const source = dedent`
      <div id="hello"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="hello"></div>
    `)
  })

  test("<br>", () => {
    const source = dedent`
      One<br> Two<br> Three<br> Four<br>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      One<br>
      Two<br>
      Three<br>
      Four<br>
    `)
  })

  test("<br> in <p>", () => {
    const source = dedent`
      <p>
        One<br> Two<br> Three<br> Four<br>
      </p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        One
        <br>
        Two
        <br>
        Three
        <br>
        Four
        <br>
      </p>
    `)
  })

  test("<hr>", () => {
    const source = dedent`
      One<hr> Two<hr> Three<hr> Four<hr>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      One

      <hr>

      Two

      <hr>

      Three

      <hr>

      Four

      <hr>
    `)
  })

  test("<hr> in <p>", () => {
    const source = dedent`
      <p>
        One<hr> Two<hr> Three<hr> Four<hr>
      </p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        One
        <hr>
        Two
        <hr>
        Three
        <hr>
        Four
        <hr>
      </p>
    `)
  })
})
