import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { TurboPermanentNoMisleadingValueRule } from "../../src/rules/turbo-permanent-no-misleading-value.js"

describe("turbo-permanent-no-misleading-value autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes `\"true\"` value", () => {
    const input = '<div id="cart" data-turbo-permanent="true">1 item</div>'
    const expected = '<div id="cart" data-turbo-permanent>1 item</div>'

    const linter = new Linter(Herb, [TurboPermanentNoMisleadingValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes `\"false\"` value", () => {
    const input = '<div id="cart" data-turbo-permanent="false">1 item</div>'
    const expected = '<div id="cart" data-turbo-permanent>1 item</div>'

    const linter = new Linter(Herb, [TurboPermanentNoMisleadingValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("removes empty string value", () => {
    const input = '<div id="cart" data-turbo-permanent="">1 item</div>'
    const expected = '<div id="cart" data-turbo-permanent>1 item</div>'

    const linter = new Linter(Herb, [TurboPermanentNoMisleadingValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("removes arbitrary value", () => {
    const input = '<div id="cart" data-turbo-permanent="foo">1 item</div>'
    const expected = '<div id="cart" data-turbo-permanent>1 item</div>'

    const linter = new Linter(Herb, [TurboPermanentNoMisleadingValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("leaves valueless attribute untouched", () => {
    const input = '<div id="cart" data-turbo-permanent>1 item</div>'

    const linter = new Linter(Herb, [TurboPermanentNoMisleadingValueRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })
})
