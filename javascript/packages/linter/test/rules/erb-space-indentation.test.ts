import { describe, test } from "vitest"

import { ERBSpaceIndentationRule } from "../../src/rules/erb-space-indentation.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBSpaceIndentationRule)

describe("ERBSpaceIndentationRule", () => {
  test("ignores empty lines", () => {
    expectNoOffenses("\n\n\n")
  })

  test("passes when no indentation", () => {
    expectNoOffenses("this is a line")
  })

  test("passes when space indentation", () => {
    expectNoOffenses("   this is a line\n   another line\n")
  })

  test("fails with tab indentation", () => {
    expectError("Indent with spaces instead of tabs.", [1])
    expectError("Indent with spaces instead of tabs.", [2])

    assertOffenses("\t\tthis is a line\n\t\tanother line\n")
  })

  test("handles mixed indentation", () => {
    expectError("Indent with spaces instead of tabs.", [1])
    expectError("Indent with spaces instead of tabs.", [2])

    assertOffenses("  \t    this is a line\n  \t  another line\n")
  })

  test("handles html template with tabs", () => {
    expectError("Indent with spaces instead of tabs.", [2])

    assertOffenses("<div>\n\t<p>hello</p>\n</div>\n")
  })

  test("fails ERB content with tab indentation", () => {
    expectError("Indent with spaces instead of tabs.", [2])

    assertOffenses("<div>\n\t<%= hello %>\n</div>\n")
  })
})
