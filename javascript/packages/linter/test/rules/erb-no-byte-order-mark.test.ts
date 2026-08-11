import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoByteOrderMarkRule } from "../../src/rules/erb-no-byte-order-mark.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import { BYTE_ORDER_MARK as BOM } from "@herb-tools/core"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoByteOrderMarkRule)
const MESSAGE = "Remove the byte order mark from the start of the file. It is an encoding signature, not template content, so it renders as an invisible character ahead of everything else and can push browsers into quirks mode. Save the file as UTF-8 without a BOM."

describe("ERBNoByteOrderMarkRule", () => {
  test("should not report errors for a file without a byte order mark", () => {
    expectNoOffenses(dedent`
      <div>
        <%= title %>
      </div>
    ` + "\n")
  })

  test("should not report errors for an empty file", () => {
    expectNoOffenses("")
  })

  test("should not report errors for a byte order mark that is not at the start of the file", () => {
    expectNoOffenses(`<div>a${BOM}b</div>\n`)
  })

  test("should not report errors for a byte order mark inside an attribute value", () => {
    expectNoOffenses(`<div title="a${BOM}b">hello</div>\n`)
  })

  test("should not report errors for a byte order mark inside an ERB String literal", () => {
    expectNoOffenses(`<div><%= "a${BOM}b" %></div>\n`)
  })

  test("should not report errors for a leading non-breaking space", () => {
    expectNoOffenses(` <div>hello</div>\n`)
  })

  test("should report an error for a leading byte order mark", () => {
    expectError(MESSAGE, { line: 1, column: 0 })

    assertOffenses(`${BOM}<div>hello</div>\n`)
  })

  test("should report an error for a byte order mark ahead of a doctype", () => {
    expectError(MESSAGE, { line: 1, column: 0 })

    assertOffenses(`${BOM}<!DOCTYPE html>\n<html></html>\n`)
  })

  test("should report an error for a byte order mark ahead of an ERB tag", () => {
    expectError(MESSAGE, { line: 1, column: 0 })

    assertOffenses(`${BOM}<%= render "header" %>\n`)
  })

  test("should report a single error for a file with two leading byte order marks", () => {
    expectError(MESSAGE, { line: 1, column: 0 })

    assertOffenses(`${BOM}${BOM}<div>hello</div>\n`)
  })

  test("should report an error for a file containing only a byte order mark", () => {
    expectError(MESSAGE, { line: 1, column: 0 })

    assertOffenses(BOM)
  })
})
