import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoInlineCaseConditionsRule } from "../../src/rules/erb-no-inline-case-conditions.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoInlineCaseConditionsRule)

describe("ERBNoInlineCaseConditionsRule", () => {
  describe("case/when", () => {
    test("valid case/when in separate ERB tags", () => {
      expectNoOffenses(dedent`
        <% case variable %>
        <% when "a" %>
          A
        <% when "b" %>
          B
        <% else %>
          Other
        <% end %>
      `)
    })

    test("invalid inline case/when", () => {
      expectWarning('A `case` statement with `when` conditions in a single ERB tag cannot be reliably parsed, compiled, and formatted. Use separate ERB tags for `case` and its conditions (e.g., `<% case x %>` followed by `<% when y %>`).')

      assertOffenses(dedent`
        <% case variable when "a" %>
          A
        <% when "b" %>
          B
        <% end %>
      `)
    })

    test("invalid case/when on newline in same tag", () => {
      expectWarning('A `case` statement with `when` conditions in a single ERB tag cannot be reliably parsed, compiled, and formatted. Use separate ERB tags for `case` and its conditions (e.g., `<% case x %>` followed by `<% when y %>`).')

      assertOffenses(`<% case variable\n   when "a" %>\n  A\n<% when "b" %>\n  B\n<% end %>`)
    })
  })

  describe("case/in", () => {
    test("valid case/in in separate ERB tags", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% in 1 %>
          One
        <% in 2 %>
          Two
        <% else %>
          Other
        <% end %>
      `)
    })

    test("invalid inline case/in", () => {
      expectWarning('A `case` statement with `in` conditions in a single ERB tag cannot be reliably parsed, compiled, and formatted. Use separate ERB tags for `case` and its conditions (e.g., `<% case x %>` followed by `<% in y %>`).')

      assertOffenses(dedent`
        <% case value in 1 %>
          One
        <% in 2 %>
          Two
        <% end %>
      `)
    })

    test("invalid case/in on newline in same tag", () => {
      expectWarning('A `case` statement with `in` conditions in a single ERB tag cannot be reliably parsed, compiled, and formatted. Use separate ERB tags for `case` and its conditions (e.g., `<% case x %>` followed by `<% in y %>`).')

      assertOffenses(`<% case value\n   in 1 %>\n  One\n<% in 2 %>\n  Two\n<% end %>`)
    })
  })
})
