import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter, DEFAULT_PRINT_OPTIONS } from "../src/index.js"

import type { PrintOptions } from "../src/index.js"

describe("Printer Options", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("DEFAULT_PRINT_OPTIONS", () => {
    test("has ignoreErrors set to false by default", () => {
      expect(DEFAULT_PRINT_OPTIONS.ignoreErrors).toBe(false)
    })
  })

  describe("track_locations option", () => {
    const source = `<div class="card">Hello</div>`
    const message = "Cannot print the node (AST_DOCUMENT_NODE) since it was parsed with `track_locations: false`. The printer needs source locations, so re-parse the source with `track_locations: true`."

    test("throws when printing a node parsed without locations", () => {
      const parseResult = Herb.parse(source, { track_whitespace: true, track_locations: false })

      expect(() => { new IdentityPrinter().print(parseResult.value!) }).toThrow(message)
    })

    test("throws when printing a parse result produced without locations", () => {
      const parseResult = Herb.parse(source, { track_whitespace: true, track_locations: false })

      expect(() => { new IdentityPrinter().print(parseResult) }).toThrow(message)
    })

    test("rejects untracked input at compile time", () => {
      const untracked = Herb.parse(source, { track_whitespace: true, track_locations: false })
      const tracked = Herb.parse(source, { track_whitespace: true })
      const printer = new IdentityPrinter()

      printer.print(tracked)
      printer.print(tracked.value)

      // @ts-expect-error a tree parsed with `track_locations: false` is not printable
      expect(() => printer.print(untracked.value)).toThrow(message)

      // @ts-expect-error a parse result produced with `track_locations: false` is not printable
      expect(() => printer.print(untracked)).toThrow(message)
    })

    test("prints normally when locations are tracked", () => {
      const parseResult = Herb.parse(source, { track_whitespace: true })

      expect(new IdentityPrinter().print(parseResult.value!)).toBe(source)
      expect(new IdentityPrinter().print(parseResult)).toBe(source)
    })
  })

  describe("ignoreErrors option", () => {
    test("throws error when printing nodes with errors (default behavior)", () => {
      const source = "<% if condition without end %>"
      const parseResult = Herb.parse(source, { track_whitespace: true })

      expect(parseResult.value).toBeDefined()
      expect(parseResult.recursiveErrors().length).toBeGreaterThan(0)

      const printer = new IdentityPrinter()

      expect(() => {
        printer.print(parseResult.value!)
      }).toThrow("Cannot print the node (AST_DOCUMENT_NODE) since it or any of its children has parse errors. Either pass in a valid Node or call `print()` using `print(node, { ignoreErrors: true })`")
    })

    test("throws error when explicitly setting ignoreErrors to false", () => {
      const source = "<% if condition without end %>"
      const parseResult = Herb.parse(source, { track_whitespace: true })

      expect(parseResult.value).toBeDefined()
      expect(parseResult.recursiveErrors().length).toBeGreaterThan(0)

      const printer = new IdentityPrinter()
      const options: PrintOptions = { ignoreErrors: false }

      expect(() => {
        printer.print(parseResult.value!, options)
      }).toThrow("Cannot print the node (AST_DOCUMENT_NODE) since it or any of its children has parse errors. Either pass in a valid Node or call `print()` using `print(node, { ignoreErrors: true })`")
    })

    test("prints nodes with errors when ignoreErrors is true", () => {
      const source = "<% if condition without end %>"
      const parseResult = Herb.parse(source, { track_whitespace: true })

      expect(parseResult.value).toBeDefined()
      expect(parseResult.recursiveErrors().length).toBeGreaterThan(0)

      const printer = new IdentityPrinter()
      const options: PrintOptions = { ignoreErrors: true }

      const output = printer.print(parseResult.value!, options)

      expect(output).toBeDefined()
      expect(typeof output).toBe("string")
      expect(output).toBe(source)
    })

    test("prints valid nodes normally with ignoreErrors true", () => {
      const source = "<div>Hello World</div>"
      const parseResult = Herb.parse(source, { track_whitespace: true })

      expect(parseResult.value).toBeDefined()
      expect(parseResult.recursiveErrors()).toEqual([])

      const printer = new IdentityPrinter()
      const options: PrintOptions = { ignoreErrors: true }

      const output = printer.print(parseResult.value!, options)
      expect(output).toBe(source)
    })

    test("prints valid nodes normally without options", () => {
      const source = "<div>Hello World</div>"
      const parseResult = Herb.parse(source, { track_whitespace: true })

      expect(parseResult.value).toBeDefined()
      expect(parseResult.recursiveErrors()).toEqual([])

      const printer = new IdentityPrinter()

      const output = printer.print(parseResult.value!)
      expect(output).toBe(source)
    })

    test("error message includes correct node type", () => {
      const sources = [
        { source: "<% if x %>", expectedType: "AST_DOCUMENT_NODE" },
        { source: "<!-- unclosed comment", expectedType: "AST_DOCUMENT_NODE" },
        { source: "<div unclosed", expectedType: "AST_DOCUMENT_NODE" }
      ]

      sources.forEach(({ source, expectedType }) => {
        const parseResult = Herb.parse(source, { track_whitespace: true })

        if (parseResult.recursiveErrors().length > 0) {
          const printer = new IdentityPrinter()

          expect(() => {
            printer.print(parseResult.value!)
          }).toThrow(`Cannot print the node (${expectedType}) since it or any of its children has parse errors. Either pass in a valid Node or call \`print()\` using \`print(node, { ignoreErrors: true })\``)
        }
      })
    })
  })
})
