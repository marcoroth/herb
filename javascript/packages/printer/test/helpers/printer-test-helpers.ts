import { expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "../../src/index.js"

import { HTMLTextNode, ERBContentNode, ERBEndNode, LiteralNode } from "@herb-tools/core"

import type { Node, ParseResult } from "@herb-tools/core"

// Utility functions for creating common test objects
export function createLocation(line = 1, column = 1) {
  return {
    start: { line, column },
    end: { line, column }
  }
}

export function createRange(start = 1, end = 2): [number, number] {
  return [start, end]
}

export function createToken(type = "", value = "", range = createRange(), location = createLocation()) {
  return {
    type,
    value,
    range,
    location
  }
}

export function createTextNode(content: string): HTMLTextNode {
  return HTMLTextNode.from({
    type: "AST_HTML_TEXT_NODE",
    location,
    errors: [],
    content
  })
}

export function createLiteralNode(content: string): LiteralNode {
  return LiteralNode.from({
    type: "AST_LITERAL_NODE",
    location,
    errors: [],
    content
  })
}

export function createERBContentNode(content: string, opening: string = "<%", closing: string = "%>"): ERBContentNode {
  return ERBContentNode.from({
    type: "AST_ERB_CONTENT_NODE",
    location,
    errors: [],
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

export const end_node = ERBEndNode.from({
  type: "AST_ERB_END_NODE",
  location,
  errors: [],
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

export function expectSourceToPrint(source: string, expectedOutput: string, failOnErrors: boolean = true) {
  const parseResult = Herb.parse(source)

  if (failOnErrors) {
    expectResultWithNoErrors(parseResult, source)
  }

  const printer = new IdentityPrinter()
  const output = printer.print(parseResult.value)

  expect(output).toBeDefined()
  expect(output).toBe(expectedOutput)
}

export function expectPrintRoundTrip(input: string, failOnErrors: boolean = true) {
  expectSourceToPrint(input, input, failOnErrors)
}
