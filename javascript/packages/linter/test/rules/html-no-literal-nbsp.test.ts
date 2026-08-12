import { describe, test } from "vitest"

import { HTMLNoLiteralNBSPRule } from "../../src/rules/html-no-literal-nbsp.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoLiteralNBSPRule)

const NBSP = "\u00A0"
const MESSAGE = "Use `&nbsp;` instead of a literal non-breaking space (U+00A0). The literal character is invisible in an editor, so it reads as a regular space and is easily lost when the file is edited."

describe("HTMLNoLiteralNBSPRule", () => {
  test("should not report errors for regular spaces", () => {
    expectNoOffenses(`<div>hello there</div>`)
  })

  test("should not report errors for the entity", () => {
    expectNoOffenses(`<div>hello&nbsp;there</div>`)
  })

  test("should not report errors for a non-breaking space inside a script element", () => {
    expectNoOffenses(`<script>var total =${NBSP}1</script>`)
  })

  test("should not report errors for a non-breaking space inside a style element", () => {
    expectNoOffenses(`<style>.a {${NBSP}color: red; }</style>`)
  })

  test("should not report errors for a non-breaking space inside an ERB tag", () => {
    expectNoOffenses(`<div><%= helper(${NBSP}1) %></div>`)
  })

  test("should not report errors for a non-breaking space inside an ERB String literal", () => {
    expectNoOffenses(`<div><%= "a${NBSP}b" %></div>`)
  })

  test("should report an error for a non-breaking space in text content", () => {
    expectError(MESSAGE, { line: 1, column: 10 })

    assertOffenses(`<div>hello${NBSP}there</div>`)
  })

  test("should report an error for a non-breaking space in an attribute value", () => {
    expectError(MESSAGE, { line: 1, column: 13 })

    assertOffenses(`<div title="a${NBSP}b">hello</div>`)
  })

  test("should report an error for a non-breaking space in an attribute value on a script element", () => {
    expectError(MESSAGE, { line: 1, column: 14 })

    assertOffenses(`<script src="a${NBSP}b"></script>`)
  })

  test("should report an error for a non-breaking space inside a pre element", () => {
    expectError(MESSAGE, { line: 1, column: 6 })

    assertOffenses(`<pre>a${NBSP}b</pre>`)
  })

  test("should report an error for text made up of only a non-breaking space", () => {
    expectError(MESSAGE, { line: 1, column: 5 })

    assertOffenses(`<div>${NBSP}</div>`)
  })

  test("should report one error per occurrence", () => {
    expectError(MESSAGE, { line: 1, column: 6 })
    expectError(MESSAGE, { line: 1, column: 8 })

    assertOffenses(`<div>a${NBSP}b${NBSP}c</div>`)
  })

  test("should report an error on the correct line in a multi line template", () => {
    expectError(MESSAGE, { line: 3, column: 3 })

    assertOffenses(`<div>\n  <span>\n  a${NBSP}b\n  </span>\n</div>`)
  })
})
