import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoUnusedLiteralsRule } from "../../src/rules/erb-no-unused-literals.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoUnusedLiteralsRule)

describe("ERBNoUnusedLiteralsRule", () => {
  test("passes for output tags", () => {
    expectNoOffenses(dedent`
      <%= "Hello, world" %>
      <%= 42 %>
      <%= true %>
      <%= nil %>
    `)
  })

  test("passes for control flow statements", () => {
    expectNoOffenses(dedent`
      <% if logged_in? %>
        <p>Welcome!</p>
      <% end %>
    `)
  })

  test("passes for method calls", () => {
    expectNoOffenses(dedent`
      <% some_method %>
      <% helper_call(arg) %>
    `)
  })

  test("passes for assignments", () => {
    expectNoOffenses(dedent`
      <% x = 1 %>
      <% name = "hello" %>
      <% @title = "Hello" %>
      <% names = ["Alice", "Bob"] %>
      <% config = { key: "value" } %>
    `)
  })

  test("fails for array literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `[:foo, :bar]` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% [:foo, :bar] %>
    `)
  })

  test("fails for false literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `false` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% false %>
    `)
  })

  test("fails for float literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `3.14` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% 3.14 %>
    `)
  })

  test("fails for hash literals", () => {
    expectWarning('Avoid using silent ERB tags for literals. `{ key: "value" }` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% { key: "value" } %>
    `)
  })

  test("fails for integer literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `42` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% 42 %>
    `)
  })

  test("fails for nil literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `nil` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% nil %>
    `)
  })

  test("fails for regex literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `/pattern/` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% /pattern/ %>
    `)
  })

  test("fails for string literals", () => {
    expectWarning('Avoid using silent ERB tags for literals. `"Logged in"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "Logged in" %>
    `)
  })

  test("fails for symbol literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `:symbol` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% :symbol %>
    `)
  })

  test("fails for true literals", () => {
    expectWarning("Avoid using silent ERB tags for literals. `true` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% true %>
    `)
  })

  test("fails for interpolated string literals", () => {
    expectWarning('Avoid using silent ERB tags for literals. `"Hello #{name}"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "Hello #{name}" %>
    `)
  })

  test("fails for arithmetic on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `10` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% 10 / 1 %>
    `)
  })

  test("fails for string method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `"hello"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "hello".upcase %>
    `)
  })

  test("fails for chained method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `"hello"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "hello".strip.downcase %>
    `)
  })

  test("fails for integer arithmetic expressions", () => {
    expectWarning('Avoid using silent ERB tags for literals. `1` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% 1 + 2 %>
    `)
  })

  test("fails for float arithmetic expressions", () => {
    expectWarning('Avoid using silent ERB tags for literals. `3.14` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% 3.14 * 2 %>
    `)
  })

  test("fails for array method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `[1, 2, 3]` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% [1, 2, 3].length %>
    `)
  })

  test("fails for hash method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `{ a: 1 }` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% { a: 1 }.keys %>
    `)
  })

  test("fails for symbol method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `:hello` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% :hello.to_s %>
    `)
  })

  test("fails for nil method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `nil` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% nil.to_s %>
    `)
  })

  test("fails for true method calls on literal receivers", () => {
    expectWarning('Avoid using silent ERB tags for literals. `true` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% true.to_s %>
    `)
  })

  test("passes for method calls without literal receiver", () => {
    expectNoOffenses(dedent`
      <% some_method.call %>
      <% helper(arg) %>
      <% foo.bar.baz %>
    `)
  })

  test("passes for method calls with no receiver", () => {
    expectNoOffenses(dedent`
      <% puts "hello" %>
      <% render partial: "header" %>
    `)
  })

  test("fails for literals in conditional statements", () => {
    expectWarning('Avoid using silent ERB tags for literals. `"success"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% valid? && "success" %>
    `)
  })
})
