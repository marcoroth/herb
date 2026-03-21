import { describe, test } from "vitest"

import { ERBSpaceIndentationRule } from "../../src/rules/erb-space-indentation.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBSpaceIndentationRule)

describe("ERBSpaceIndentationRule", () => {
  test("no indentation present", () => {
    expectNoOffenses("this is a line")
  })

  test("space indentation present", () => {
    expectNoOffenses("   this is a line\n   another line\n")
  })

  test("tab indentation", () => {
    expectError("Indent with spaces instead of tabs.", [1])
    expectError("Indent with spaces instead of tabs.", [2])
    assertOffenses("\t\tthis is a line\n\t\tanother line\n")
  })

  test("tab and spaces indentation", () => {
    expectError("Indent with spaces instead of tabs.", [1])
    expectError("Indent with spaces instead of tabs.", [2])
    assertOffenses("  \t    this is a line\n  \t  another line\n")
  })

  test("mixed content with tabs", () => {
    expectError("Indent with spaces instead of tabs.", [2])
    assertOffenses("<div>\n\t<p>hello</p>\n</div>\n")
  })

  test("tabs only at start of line", () => {
    expectNoOffenses("hello\tworld\n")
  })

  test("empty lines are fine", () => {
    expectNoOffenses("\n\n\n")
  })

  test("ERB content with tab indentation", () => {
    expectError("Indent with spaces instead of tabs.", [2])
    assertOffenses("<div>\n\t<%= hello %>\n</div>\n")
  })
})
