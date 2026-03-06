import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoThenInControlFlowRule } from "../../src/rules/erb-no-then-in-control-flow.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoThenInControlFlowRule)

describe("ERBNoThenInControlFlowRule", () => {
  describe("if", () => {
    test("valid if without then", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          yes
        <% end %>
      `)
    })

    test("invalid if with then", () => {
      expectWarning("Avoid using `then` in `if` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% if condition then %>
          yes
        <% end %>
      `)
    })
  })

  describe("elsif", () => {
    test("valid elsif without then", () => {
      expectNoOffenses(dedent`
        <% if condition %>
          yes
        <% elsif other_condition %>
          no
        <% end %>
      `)
    })

    test("invalid elsif with then", () => {
      expectWarning("Avoid using `then` in `elsif` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% if condition %>
          yes
        <% elsif other_condition then %>
          no
        <% end %>
      `)
    })
  })

  describe("unless", () => {
    test("valid unless without then", () => {
      expectNoOffenses(dedent`
        <% unless logged_in? %>
          please log in
        <% end %>
      `)
    })

    test("invalid unless with then", () => {
      expectWarning("Avoid using `then` in `unless` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% unless condition then %>
          please log in
        <% end %>
      `)
    })
  })

  describe("case/when", () => {
    test("valid case/when without then", () => {
      expectNoOffenses(dedent`
        <% case status %>
        <% when :ok %>
          success
        <% when :error %>
          failure
        <% else %>
          unknown
        <% end %>
      `)
    })

    test("invalid when with then", () => {
      expectWarning("Avoid using `then` in `when` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% case status %>
        <% when :ok then %>
          success
        <% end %>
      `)
    })
  })

  describe("case/in", () => {
    test("valid case/in without then", () => {
      expectNoOffenses(dedent`
        <% case value %>
        <% in Integer %>
          number
        <% in String %>
          string
        <% end %>
      `)
    })

    test("invalid in with then", () => {
      expectWarning("Avoid using `then` in `in` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% case value %>
        <% in Integer then %>
          number
        <% end %>
      `)
    })
  })

  describe("multiple offenses", () => {
    test("reports multiple then keywords", () => {
      expectWarning("Avoid using `then` in `if` expressions inside ERB templates. Use the multiline block form instead.")
      expectWarning("Avoid using `then` in `elsif` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% if condition then %>
          yes
        <% elsif other then %>
          no
        <% end %>
      `)
    })

    test("no offenses for inline case/when with then in a single ERB tag", () => {
      expectNoOffenses(dedent`
        <% header_error = case
          when header.blank? then t(".required")
          when @form.headers.count(header) > 1 then t(".duplicate")
          end %>
        `)
    })

    test("reports multiple when with then keywords", () => {
      expectWarning("Avoid using `then` in `when` expressions inside ERB templates. Use the multiline block form instead.")
      expectWarning("Avoid using `then` in `when` expressions inside ERB templates. Use the multiline block form instead.")

      assertOffenses(dedent`
        <% header_error = case %>
        <% when header.blank? then t(".required") %>
        <% when @form.headers.count(header) > 1 then t(".duplicate") %>
        <% end %>
      `)
    })
  })
})
