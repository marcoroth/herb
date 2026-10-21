import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoReturnRule } from "../../src/rules/erb-no-return.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } =
  createLinterTest(ERBNoReturnRule)

const MESSAGE =
  "Avoid using `return` in ERB templates. Use a conditional or move the logic to a controller or component."

const BLOCK_MESSAGE =
  "Avoid using `return` inside a block or loop in ERB templates because it ends the whole render. Use `next` to skip the rest of the block or `break` to stop iterating."

describe("ERBNoReturnRule", () => {
  test("ignores conditionals", () => {
    expectNoOffenses(dedent`
      <% if condition? %>
        <p>Content</p>
      <% end %>
    `)
  })

  test("ignores comments", () => {
    expectNoOffenses("<%# return unless condition? %>")
  })

  test("ignores strings", () => {
    expectNoOffenses('<%= "return unless condition?" %>')
  })

  test("ignores method names", () => {
    expectNoOffenses("<%= returning(record) { |value| value } %>")
  })

  test("fails for a return with a value", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses('<% return "" unless condition? %>')
  })

  test("fails for a bare return", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses("<% return %>")
  })

  test("fails when content follows return", () => {
    expectError(MESSAGE, [1, 3])

    assertOffenses(dedent`
      <% return "" unless condition? %>
      <p>Content</p>
    `)
  })

  test("fails for every nested return", () => {
    expectError(MESSAGE, [3, 4])
    expectError(MESSAGE, [5, 4])

    assertOffenses(dedent`
      <%
        if condition?
          return "first"
        else
          return "second"
        end
      %>
    `)
  })

  test("ignores return inside a stabby lambda with braces", () => {
    expectNoOffenses("<% f = ->(t) { return nil unless t; t } %>")
  })

  test("ignores return inside a stabby lambda with do end", () => {
    expectNoOffenses(dedent`
      <% f = ->(t) do
           return nil unless t
           t
         end %>
    `)
  })

  test("ignores return inside lambda with braces", () => {
    expectNoOffenses("<% f = lambda { return 1 } %>")
  })

  test("ignores return inside lambda with do end", () => {
    expectNoOffenses(dedent`
      <% f = lambda do
           return 1
         end %>
    `)
  })

  test("ignores return inside a block inside a lambda", () => {
    expectNoOffenses("<% f = -> { items.each { |i| return i } } %>")
  })

  test("ignores return inside a proc inside a lambda", () => {
    expectNoOffenses("<% f = -> { proc { return } } %>")
  })

  test("ignores return inside a method definition", () => {
    expectNoOffenses(dedent`
      <%
        def helper(value)
          return 1 if value
          2
        end
      %>
    `)
  })

  test("ignores return inside define_method", () => {
    expectNoOffenses("<% define_method(:helper) { return 1 } %>")
  })

  test("ignores return inside a multi-line lambda", () => {
    expectNoOffenses(dedent`
      <% find_time_for_talk = ->(t) {
           return nil unless t
           slot = time_slot_talks.find { |_, s| s[:talks].any? { |st| st&.id == t.id } }
           slot ? [slot[1][:start_time], slot[1][:end_time]].uniq.join(" - ") : nil
         } %>

      <%= find_time_for_talk.call(talk) %>
    `)
  })

  test("fails for return inside a block", () => {
    expectError(BLOCK_MESSAGE, [1, 20])

    assertOffenses("<% items.each { |i| return if i } %>")
  })

  test("fails for return inside a block across ERB tags", () => {
    expectError(BLOCK_MESSAGE, [2, 5])

    assertOffenses(dedent`
      <% items.each do |item| %>
        <% return if item.hidden? %>
        <li><%= item.name %></li>
      <% end %>
    `)
  })

  test("fails for return inside a while loop", () => {
    expectError(BLOCK_MESSAGE, [1, 21])

    assertOffenses("<% while running? do return end %>")
  })

  test("fails for return inside a proc", () => {
    expectError(MESSAGE, [1, 10])

    assertOffenses("<% proc { return } %>")
  })

  test("fails for return inside Proc.new", () => {
    expectError(MESSAGE, [1, 14])

    assertOffenses("<% Proc.new { return } %>")
  })

  test("fails for return inside a block inside a proc", () => {
    expectError(BLOCK_MESSAGE, [1, 23])

    assertOffenses("<% proc { items.each { return } } %>")
  })

  test("fails only for the return outside of a lambda in the same tag", () => {
    expectError(MESSAGE, [1, 24])

    assertOffenses("<% f = -> { return 1 }; return if x %>")
  })
})
