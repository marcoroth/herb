import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBNoSilentStatementRule } from "../../src/rules/erb-no-silent-statement.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoSilentStatementRule)

describe("ERBNoSilentStatementRule", () => {
  test("should not report for output tags", () => {
    expectNoOffenses(dedent`
      <div>
        <%= title %>
        <%= render "partial" %>
        <%== raw_html %>
      </div>
    `)
  })

  test("should not report for local variable assignments", () => {
    expectNoOffenses(dedent`
      <div>
        <% x = 1 %>
        <% name = "hello" %>
      </div>
    `)
  })

  test("should not report for instance variable assignments", () => {
    expectNoOffenses(dedent`
      <div>
        <% @title = "Hello" %>
      </div>
    `)
  })

  test("should not report for or-assignment operators", () => {
    expectNoOffenses(dedent`
      <div>
        <% x ||= default_value %>
        <% @count ||= 0 %>
      </div>
    `)
  })

  test("should not report for and-assignment operators", () => {
    expectNoOffenses(dedent`
      <div>
        <% x &&= other_value %>
      </div>
    `)
  })

  test("should not report for operator assignments", () => {
    expectNoOffenses(dedent`
      <div>
        <% x += 1 %>
        <% @count -= 1 %>
      </div>
    `)
  })

  test("should not report for control flow statements", () => {
    expectNoOffenses(dedent`
      <% if user.admin? %>
        Admin tools
      <% end %>

      <% unless user.banned? %>
        Content
      <% end %>

      <% user.posts.each do |post| %>
        <p><%= post.title %></p>
      <% end %>
    `)
  })

  test("should report for method calls", () => {
    expectWarning(
      'Avoid using silent ERB tags for statements. Move `some_method` to a controller, helper, or presenter.',
      { line: 2, column: 2 },
    )

    assertOffenses(dedent`
      <div>
        <% some_method %>
      </div>
    `)
  })

  test("should report for method calls with arguments", () => {
    expectWarning(
      'Avoid using silent ERB tags for statements. Move `helper_call(arg)` to a controller, helper, or presenter.',
      { line: 2, column: 2 },
    )

    assertOffenses(dedent`
      <div>
        <% helper_call(arg) %>
      </div>
    `)
  })

  test("should not report for constant assignments", () => {
    expectNoOffenses(dedent`
      <div>
        <% CONSTANT = "value" %>
      </div>
    `)
  })

  test("should not report for multi-assignment", () => {
    expectNoOffenses(dedent`
      <div>
        <% a, b = 1, 2 %>
      </div>
    `)
  })
})
