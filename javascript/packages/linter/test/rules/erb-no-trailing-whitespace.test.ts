import dedent from "dedent"
import { describe, test } from "vitest"

import { createLinterTest } from "../helpers/linter-test-helper.js"
import { ERBNoTrailingWhitespaceRule } from "../../src/rules/erb-no-trailing-whitespace.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoTrailingWhitespaceRule)

describe("erb-no-trailing-whitespace", () => {
  test("when empty string", () => {
    expectNoOffenses("")
  })

  test("when no trailing whitespace", () => {
    expectNoOffenses(dedent`
      <div>
        <p>Hello</p>
      </div>
    `)
  })

  test("with leading whitespace", () => {
    expectNoOffenses("  <div>Hello</div>")
  })

  test("with trailing spaces", () => {
    expectError("Extra whitespace detected at end of line.", [1, 5])

    assertOffenses("Hello   ")
  })

  test("with trailing tab", () => {
    expectError("Extra whitespace detected at end of line.", [1, 5])

    assertOffenses("Hello\t")
  })

  test("handles multiple lines", () => {
    expectError("Extra whitespace detected at end of line.", [1, 5])
    expectError("Extra whitespace detected at end of line.", [2, 5])

    assertOffenses("Hello \nWorld \nClean")
  })

  test("when a line has only whitespace", () => {
    expectError("Extra whitespace detected at end of line.", [2, 0])

    assertOffenses("<div>\n   \n</div>")
  })

  test("with trailing whitespace after HTML tag", () => {
    expectError("Extra whitespace detected at end of line.", [1, 16])

    assertOffenses("<div>Hello</div>  ")
  })

  test("with trailing whitespace after ERB tag", () => {
    expectError("Extra whitespace detected at end of line.", [1, 14])

    assertOffenses("<%= content %> ")
  })

  test("detects mixed whitespace", () => {
    expectError("Extra whitespace detected at end of line.", [1, 5])

    assertOffenses("Hello \t ")
  })
})
