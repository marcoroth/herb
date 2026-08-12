import { expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../../src/index.js"

import { HTMLTextNode, ERBContentNode, ERBEndNode, LiteralNode, Location, Range, Token } from "@herb-tools/core"

import type { Node, ParseResult, ParseOptions } from "@herb-tools/core"

export function createLocation(line = 1, column = 1): Location {
  return Location.from(line, column, line, column)
}

export function createRange(start = 1, end = 2): Range {
  return Range.from(start, end)
}

export function createToken(type = "", value = "", range = createRange(), location = createLocation()): Token {
  return new Token(value, range, location, type)
}

export function createTextNode(content: string): HTMLTextNode {
  return HTMLTextNode.build({
    location,
    content
  })
}

export function createLiteralNode(content: string): LiteralNode {
  return LiteralNode.build({
    location,
    content
  })
}

export function createERBContentNode(content: string, opening: string = "<%", closing: string = "%>"): ERBContentNode {
  return ERBContentNode.build({
    location,
    tag_opening: createToken("TOKEN_ERB_START", opening),
    content: createToken("TOKEN_ERB_CONTENT", content),
    tag_closing: createToken("TOKEN_ERB_END", closing),
    parsed: false,
    valid: false
  })
}

export const location = createLocation()
export const range = createRange()
export const singleQuote = createToken("TOKEN_QUOTE", `'`)
export const doubleQuote = createToken("TOKEN_QUOTE", `"`)

export const end_node = ERBEndNode.build({
  location,
  tag_opening: createToken("TOKEN_ERB_START", "<%"),
  content: createToken("TOKEN_ERB_CONTENT", " end "),
  tag_closing: createToken("TOKEN_ERB_END", "%>"),
})

export function expectNodeToPrint(node: Node, expectedOutput: string) {
  const printer = new IdentityPrinter()
  const output = printer.print(node)

  expect(node).toBeDefined()
  expect(output).toBeDefined()
  expect(output).toBe(expectedOutput)
}

export function expectResultWithNoErrors(parseResult: ParseResult, source: string) {
  expect(parseResult.successful, source).toBeTruthy()
  expect(parseResult.value, source).toBeDefined()
  expect(parseResult.errors, source).toEqual([])
  expect(parseResult.recursiveErrors(), source).toEqual([])
  expect(parseResult.value.errors, source).toEqual([])
  expect(parseResult.value.recursiveErrors(), source).toEqual([])
}

export function expectSourceToPrint(source: string, expectedOutput: string, failOnErrors: boolean = true, parseOptions: ParseOptions = {}) {
  const parseResult = Herb.parse(source, { track_whitespace: true, ...parseOptions })

  if (failOnErrors) {
    expectResultWithNoErrors(parseResult, source)
  }

  const printer = new IdentityPrinter()
  const output = printer.print(parseResult.value, { ignoreErrors: !failOnErrors })

  expect(output).toBeDefined()
  expect(output).toBe(expectedOutput)
}

export function expectPrintRoundTrip(input: string, failOnErrors: boolean = true, parseOptions: ParseOptions = {}) {
  expectSourceToPrint(input, input, failOnErrors, parseOptions)
}
