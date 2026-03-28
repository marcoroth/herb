import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoDebugOutputRule } from "../../src/rules/erb-no-debug-output.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoDebugOutputRule)

describe("ERBNoDebugOutputRule", () => {
  describe("valid cases", () => {
    test("passes for regular method calls", () => {
      expectNoOffenses(dedent`
        <% render partial: "header" %>
        <% some_method %>
        <% helper_call(arg) %>
      `)
    })

    test("passes for output tags", () => {
      expectNoOffenses(dedent`
        <%= content_tag(:p, "Hello") %>
        <%= link_to "Home", root_path %>
      `)
    })

    test("passes for control flow", () => {
      expectNoOffenses(dedent`
        <% if logged_in? %>
          <p>Welcome!</p>
        <% end %>
      `)
    })

    test("passes for assignments", () => {
      expectNoOffenses(dedent`
        <% name = "hello" %>
        <% @title = "Hello" %>
      `)
    })

    test("passes for method calls with a receiver", () => {
      expectNoOffenses(dedent`
        <% $stdout.puts "hello" %>
        <% logger.print "debug info" %>
        <% object.p %>
      `)
    })

    test("passes for p used as a tag helper", () => {
      expectNoOffenses(dedent`
        <%= content_tag(:p, "paragraph") %>
      `)
    })

    test("passes for iterators and blocks", () => {
      expectNoOffenses(dedent`
        <% @items.each do |item| %>
          <%= item.name %>
        <% end %>
      `)
    })
  })

  describe("invalid cases", () => {
    test("fails for puts in silent tag", () => {
      expectError('Avoid using `puts "hello"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <% puts "hello" %>
      `)
    })

    test("fails for p in silent tag", () => {
      expectError("Avoid using `p @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% p @user %>
      `)
    })

    test("fails for print in silent tag", () => {
      expectError('Avoid using `print "debug"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <% print "debug" %>
      `)
    })

    test("fails for puts in output tag", () => {
      expectError('Avoid using `puts "hello"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <%= puts "hello" %>
      `)
    })

    test("fails for p in output tag", () => {
      expectError("Avoid using `p @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <%= p @user %>
      `)
    })

    test("fails for print in output tag", () => {
      expectError('Avoid using `print "debug"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <%= print "debug" %>
      `)
    })

    test("fails for pp in silent tag", () => {
      expectError("Avoid using `pp @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% pp @user %>
      `)
    })

    test("fails for pp in output tag", () => {
      expectError("Avoid using `pp @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <%= pp @user %>
      `)
    })

    test("fails for warn in silent tag", () => {
      expectError('Avoid using `warn "something went wrong"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <% warn "something went wrong" %>
      `)
    })

    test("fails for debug in output tag", () => {
      expectError("Avoid using `debug @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <%= debug @user %>
      `)
    })

    test("fails for debug in silent tag", () => {
      expectError("Avoid using `debug @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% debug @user %>
      `)
    })

    test("fails for byebug", () => {
      expectError("Avoid using `byebug` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% byebug %>
      `)
    })

    test("fails for binding.pry", () => {
      expectError("Avoid using `binding.pry` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% binding.pry %>
      `)
    })

    test("fails for binding.irb", () => {
      expectError("Avoid using `binding.irb` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% binding.irb %>
      `)
    })

    test("fails for puts with no arguments", () => {
      expectError("Avoid using `puts` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% puts %>
      `)
    })

    test("fails for multiple debug calls", () => {
      expectError('Avoid using `puts "hello"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')
      expectError("Avoid using `p @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% puts "hello" %>
        <% p @user %>
      `)
    })

    test("fails for puts with multiple arguments", () => {
      expectError('Avoid using `puts "name:", @user.name` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <% puts "name:", @user.name %>
      `)
    })

    test("fails for p with interpolated string", () => {
      expectError('Avoid using `p "User: #{@user.name}"` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.')

      assertOffenses(dedent`
        <% p "User: #{@user.name}" %>
      `)
    })

    test("fails for debug output inside conditionals", () => {
      expectError("Avoid using `puts @user` in ERB templates. Remove the debug output or use `<%= ... %>` to display content.")

      assertOffenses(dedent`
        <% if debug? %>
          <% puts @user %>
        <% end %>
      `)
    })
  })
})
