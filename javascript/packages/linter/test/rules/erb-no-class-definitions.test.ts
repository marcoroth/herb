import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoClassDefinitionsRule } from "../../src/rules/erb-no-class-definitions.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(
  ERBNoClassDefinitionsRule,
)

describe("ERBNoClassDefinitionsRule", () => {
  test("ignores class instantiations", () => {
    expectNoOffenses('<%= BadgeComponent.new(label: "New").render %>')
  })

  test("ignores modules", () => {
    expectNoOffenses(
      '<% module ViewHelpers; def title; "Dashboard"; end; end %>',
    )
  })

  test("ignores singleton classes", () => {
    expectNoOffenses('<% class << self; def title; "Dashboard"; end; end %>')
  })

  test("ignores comments", () => {
    expectNoOffenses(dedent`
      <%# class BadgeComponent; end %>
    `)
  })

  test("ignores strings", () => {
    expectNoOffenses(dedent`
      <%= "class BadgeComponent; end" %>
    `)
  })

  test("fails for basic class definition", () => {
    expectError(
      "Avoid defining classes in ERB templates. Move this class to a model, helper, or view object.",
      [1, 3],
    )

    assertOffenses(dedent`
      <% class BadgeComponent < ViewComponent::Base; end %>
    `)
  })

  test("fails for a multiline class definition", () => {
    expectError(
      "Avoid defining classes in ERB templates. Move this class to a model, helper, or view object.",
      [2, 2],
    )

    assertOffenses(dedent`
      <%
        class BadgeComponent < ViewComponent::Base
          def render
            tag.span("NEW", class: "badge")
          end
        end
      %>
    `)
  })

  test("fails for every nested class definition", () => {
    expectError(
      "Avoid defining classes in ERB templates. Move this class to a model, helper, or view object.",
      [2, 2],
    )
    expectError(
      "Avoid defining classes in ERB templates. Move this class to a model, helper, or view object.",
      [3, 4],
    )

    assertOffenses(dedent`
      <%
        class Outer
          class Inner; end
        end
      %>
    `)
  })
})
