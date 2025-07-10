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

  test("does not wrap single attribute", () => {
    const source = dedent`
      <div class="foo"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo"></div>
    `)
  })

  test("keeps 2 attributes inline", () => {
    const source = dedent`
      <div class="foo" id="bar"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo" id="bar"></div>
    `)
  })

  test("keeps 3 attributes inline", () => {
    const source = dedent`
      <div class="foo" id="bar" data-test="value"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo" id="bar" data-test="value"></div>
    `)
  })

  test("wraps 4+ attributes correctly", () => {
    const source = dedent`
      <div class="foo" id="bar" data-test="value" role="button"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        class="foo"
        id="bar"
        data-test="value"
        role="button"
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

  test("formats self-closing input without attributes", () => {
    const source = dedent`
      <input />
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input />
    `)
  })

  test("formats input without closing slash", () => {
    const source = dedent`
      <input>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input>
    `)
  })

  test("formats self-closing input with boolean attribute", () => {
    const source = dedent`
      <input required />
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input required />
    `)
  })

  test("formats input with boolean attribute without closing slash", () => {
    const source = dedent`
      <input required>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input required>
    `)
  })

  test("formats self-closing input with 4+ attributes", () => {
    const source = dedent`
      <input type="text" name="username" required readonly />
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        type="text"
        name="username"
        required
        readonly
      />
    `)
  })

  test("formats input with 4+ attributes without closing slash", () => {
    const source = dedent`
      <input type="text" name="username" required readonly>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        type="text"
        name="username"
        required
        readonly
      >
    `)
  })
})
