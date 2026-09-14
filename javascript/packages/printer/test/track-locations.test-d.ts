import { describe, test, expectTypeOf } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../src/index.js"

import type { ParseResult, LocationlessParseResult } from "@herb-tools/core"

const source = `<div class="card">Hello</div>`

describe("track_locations types", () => {
  test("parses without `track_locations: false` return a `ParseResult`", () => {
    expectTypeOf(Herb.parse(source)).toEqualTypeOf<ParseResult>()
    expectTypeOf(Herb.parse(source, { track_locations: true })).toEqualTypeOf<ParseResult>()
    expectTypeOf(Herb.parse(source, { track_whitespace: true })).toEqualTypeOf<ParseResult>()
  })

  test("`track_locations: false` returns a `LocationlessParseResult`", () => {
    expectTypeOf(Herb.parse(source, { track_locations: false })).toEqualTypeOf<LocationlessParseResult>()
  })

  test("options resolved at runtime keep returning a `ParseResult`", () => {
    const options = { track_locations: Math.random() > 0.5 }

    expectTypeOf(Herb.parse(source, options)).toEqualTypeOf<ParseResult>()
  })

  test("the printer accepts trees parsed with locations", () => {
    const printer = new IdentityPrinter()
    const result = Herb.parse(source, { track_whitespace: true })

    expectTypeOf(printer.print(result)).toBeString()
    expectTypeOf(printer.print(result.value)).toBeString()
  })

  test("the printer rejects trees parsed without locations", () => {
    const printer = new IdentityPrinter()
    const result = Herb.parse(source, { track_locations: false })

    // @ts-expect-error a parse result produced with `track_locations: false` is not printable
    printer.print(result)

    // @ts-expect-error a tree parsed with `track_locations: false` is not printable
    printer.print(result.value)
  })
})
