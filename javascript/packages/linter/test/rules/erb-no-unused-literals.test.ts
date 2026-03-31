import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoUnusedLiteralsRule } from "../../src/rules/erb-no-unused-literals.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnusedLiteralsRule)

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
      <% helper_call("arg") %>
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

  test("passes for assignments with ternary operator", () => {
    expectNoOffenses(dedent`
      <% dynamic_link = post.published? ? post_path(post) : "/" %>
    `)
  })

  test("passes for operator assignments", () => {
    expectNoOffenses(dedent`
      <% count += 1 %>
      <% name ||= "default" %>
      <% value &&= "updated" %>
    `)
  })

  test("passes for instance variable or-assign", () => {
    expectNoOffenses(dedent`
      <% @config ||= { key: "value" } %>
      <% @title ||= "Default Title" %>
      <% @items ||= [] %>
    `)
  })

  test("passes for class variable operator assignments", () => {
    expectNoOffenses(dedent`
      <% @@count += 1 %>
    `)
  })

  test("passes for global variable assignments", () => {
    expectNoOffenses(dedent`
      <% $debug = true %>
      <% $locale = "en" %>
    `)
  })

  test("passes for multi-write assignments", () => {
    expectNoOffenses(dedent`
      <% a, b = 1, 2 %>
    `)
  })

  test("passes for constant assignments", () => {
    expectNoOffenses(dedent`
      <% MAX_RETRIES = 3 %>
    `)
  })

  test("passes for constant path assignments", () => {
    expectNoOffenses(dedent`
      <% Config::MAX = 100 %>
    `)
  })

  test("passes for bracket assignment", () => {
    expectNoOffenses(dedent`
      <% @hash[:key] = value %>
      <% @array[0] = value %>
      <% @hash["string_key"] = value %>
    `)
  })

  test("passes for method calls with literal arguments", () => {
    expectNoOffenses(dedent`
      <% render partial: "header" %>
      <% redirect_to "/home" %>
      <% flash[:notice] = "Saved" %>
      <% link_to "Home", root_path %>
    `)
  })

  test("passes for method calls with integer arguments", () => {
    expectNoOffenses(dedent`
      <% sleep 1 %>
      <% @items.insert(0, item) %>
      <% @items.delete_at(2) %>
    `)
  })

  test("passes for method calls with symbol arguments", () => {
    expectNoOffenses(dedent`
      <% content_for :head do %>
        <title>Page Title</title>
      <% end %>
    `)
  })

  test("passes for method calls with hash arguments", () => {
    expectNoOffenses(dedent`
      <% render partial: "header", locals: { title: "Hello" } %>
    `)
  })

  test("passes for method calls with array arguments", () => {
    expectNoOffenses(dedent`
      <% @items.push([1, 2, 3]) %>
    `)
  })

  test("passes for shovel operator with literal", () => {
    expectNoOffenses(dedent`
      <% @items << "new item" %>
      <% @items << 42 %>
      <% @items << :symbol %>
    `)
  })

  test("passes for mutation methods with literal arguments", () => {
    expectNoOffenses(dedent`
      <% @items.push("item") %>
      <% @items.unshift(0) %>
      <% @hash.delete(:key) %>
      <% @items.concat(["a", "b"]) %>
    `)
  })

  test("fails for array literals", () => {
    expectError("Avoid using silent ERB tags for literals. `[:foo, :bar]` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% [:foo, :bar] %>
    `)
  })

  test("fails for false literals", () => {
    expectError("Avoid using silent ERB tags for literals. `false` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% false %>
    `)
  })

  test("fails for float literals", () => {
    expectError("Avoid using silent ERB tags for literals. `3.14` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% 3.14 %>
    `)
  })

  test("fails for hash literals", () => {
    expectError('Avoid using silent ERB tags for literals. `{ key: "value" }` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% { key: "value" } %>
    `)
  })

  test("fails for integer literals", () => {
    expectError("Avoid using silent ERB tags for literals. `42` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% 42 %>
    `)
  })

  test("fails for nil literals", () => {
    expectError("Avoid using silent ERB tags for literals. `nil` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% nil %>
    `)
  })

  test("fails for regex literals", () => {
    expectError("Avoid using silent ERB tags for literals. `/pattern/` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% /pattern/ %>
    `)
  })

  test("fails for string literals", () => {
    expectError('Avoid using silent ERB tags for literals. `"Logged in"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "Logged in" %>
    `)
  })

  test("fails for symbol literals", () => {
    expectError("Avoid using silent ERB tags for literals. `:symbol` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% :symbol %>
    `)
  })

  test("fails for true literals", () => {
    expectError("Avoid using silent ERB tags for literals. `true` is evaluated but never used or output.")

    assertOffenses(dedent`
      <% true %>
    `)
  })

  test("fails for interpolated string literals", () => {
    expectError('Avoid using silent ERB tags for literals. `"Hello #{name}"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "Hello #{name}" %>
    `)
  })

  test("fails for arithmetic on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `10` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% 10 / 1 %>
    `)
  })

  test("fails for string method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `"hello"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "hello".upcase %>
    `)
  })

  test("fails for chained method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `"hello"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "hello".strip.downcase %>
    `)
  })

  test("fails for integer arithmetic expressions", () => {
    expectError('Avoid using silent ERB tags for literals. `1` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% 1 + 2 %>
    `)
  })

  test("fails for float arithmetic expressions", () => {
    expectError('Avoid using silent ERB tags for literals. `3.14` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% 3.14 * 2 %>
    `)
  })

  test("fails for array method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `[1, 2, 3]` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% [1, 2, 3].length %>
    `)
  })

  test("fails for hash method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `{ a: 1 }` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% { a: 1 }.keys %>
    `)
  })

  test("fails for symbol method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `:hello` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% :hello.to_s %>
    `)
  })

  test("fails for nil method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `nil` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% nil.to_s %>
    `)
  })

  test("fails for true method calls on literal receivers", () => {
    expectError('Avoid using silent ERB tags for literals. `true` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% true.to_s %>
    `)
  })

  test("fails for string literals in ternary without assignment", () => {
    expectError('Avoid using silent ERB tags for literals. `"true"` is evaluated but never used or output.')
    expectError('Avoid using silent ERB tags for literals. `"false"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% condition? ? "true" : "false" %>
    `)
  })

  test("fails for boolean literals in ternary without assignment", () => {
    expectError('Avoid using silent ERB tags for literals. `true` is evaluated but never used or output.')
    expectError('Avoid using silent ERB tags for literals. `false` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% condition? ? true : false %>
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
    expectError('Avoid using silent ERB tags for literals. `"success"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% valid? && "success" %>
    `)
  })

  test("fails for literal in logical OR", () => {
    expectError('Avoid using silent ERB tags for literals. `"fallback"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% valid? || "fallback" %>
    `)
  })

  test("fails for literals in ternary without assignment", () => {
    expectError('Avoid using silent ERB tags for literals. `"yes"` is evaluated but never used or output.')
    expectError('Avoid using silent ERB tags for literals. `"no"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% post.published? ? "yes" : "no" %>
    `)
  })

  test("fails for frozen string literal", () => {
    expectError('Avoid using silent ERB tags for literals. `"hello"` is evaluated but never used or output.')

    assertOffenses(dedent`
      <% "hello".freeze %>
    `)
  })
})
