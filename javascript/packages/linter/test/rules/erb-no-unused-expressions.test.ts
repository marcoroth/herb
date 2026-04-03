import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoUnusedExpressionsRule } from "../../src/rules/erb-no-unused-expressions.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, expectWarning, assertOffenses } = createLinterTest(ERBNoUnusedExpressionsRule)

describe("ERBNoUnusedExpressionsRule", () => {
  describe("valid cases", () => {
    test("passes for output tags with method calls", () => {
      expectNoOffenses(dedent`
        <%= @user.name %>
        <%= helper_method(arg) %>
        <%= foo.bar.baz %>
      `)
    })

    test("passes for output tags with variables", () => {
      expectNoOffenses(dedent`
        <%= @user %>
        <%= @title %>
      `)
    })

    test("passes for assignments", () => {
      expectNoOffenses(dedent`
        <% @name = @user.name %>
        <% title = "Hello" %>
        <% @users = User.all %>
      `)
    })

    test("passes for operator assignments", () => {
      expectNoOffenses(dedent`
        <% @count += 1 %>
        <% @name ||= "default" %>
        <% @value &&= transform(@value) %>
      `)
    })

    test("passes for control flow", () => {
      expectNoOffenses(dedent`
        <% if logged_in? %>
          <p>Welcome!</p>
        <% end %>
      `)
    })

    test("passes for unless control flow", () => {
      expectNoOffenses(dedent`
        <% unless admin? %>
          <p>Not authorized</p>
        <% end %>
      `)
    })

    test("passes for case control flow", () => {
      expectNoOffenses(dedent`
        <% case role %>
        <% when "admin" %>
          <p>Admin</p>
        <% end %>
      `)
    })

    test("passes for iterators with blocks", () => {
      expectNoOffenses(dedent`
        <% @users.each do |user| %>
          <%= user.name %>
        <% end %>
      `)
    })

    test("passes for method calls with curly brace blocks", () => {
      expectNoOffenses(dedent`
        <% @users.each { |user| %>
          <%= user.name %>
        <% } %>
      `)
    })

    test("passes for content_for with block", () => {
      expectNoOffenses(dedent`
        <% content_for :head do %>
          <title>Page Title</title>
        <% end %>
      `)
    })

    test("passes for content_for with arguments", () => {
      expectNoOffenses(dedent`
        <% content_for :title, "Status" %>
        <% content_for :description, page_description %>
      `)
    })

    test("passes for content_for with single argument", () => {
      expectNoOffenses(dedent`
        <% content_for :title %>
      `)
    })

    test("passes for content_for with curly brace block", () => {
      expectNoOffenses(dedent`
        <% content_for(:head) { %>
          <title>Page Title</title>
        <% } %>
      `)
    })

    test("passes for provide with arguments", () => {
      expectNoOffenses(dedent`
        <% provide :title, "Status" %>
        <% provide :description, page_description %>
      `)
    })

    test("passes for flush", () => {
      expectNoOffenses(dedent`
        <% flush %>
      `)
    })

    test("passes for Turbo helpers", () => {
      expectNoOffenses(dedent`
        <% turbo_refreshes_with method: :morph, scroll: :preserve %>
        <% turbo_exempts_page_from_cache %>
        <% turbo_exempts_page_from_preview %>
        <% turbo_page_requires_reload %>
      `)
    })

    test("passes for assert_valid_keys", () => {
      expectNoOffenses(dedent`
        <%
          link.assert_valid_keys(:href, :name, :leading_icon, :target)
          href = link.fetch(:href)
          name = link.fetch(:name)
          icon = link[:leading_icon]
          target = link[:target]
        %>
      `)
    })

    test("passes for ERB comments", () => {
      expectNoOffenses(dedent`
        <%# This is a comment %>
      `)
    })

    test("passes for empty ERB tags", () => {
      expectNoOffenses(dedent`
        <% %>
      `)
    })

    test("passes for render calls (handled by actionview-no-silent-render)", () => {
      expectNoOffenses(dedent`
        <% render partial: "header" %>
        <% render "footer" %>
      `)
    })

    test("passes for method calls on render block locals", () => {
      expectNoOffenses(dedent`
        <%= render BlogComponent.new do |component| %>
          <% component.with_header(classes: "title").with_content("My blog") %>
        <% end %>
      `)
    })

    test("passes for simple method call on render block local", () => {
      expectNoOffenses(dedent`
        <%= render BlogComponent.new do |component| %>
          <% component.with_header %>
        <% end %>
      `)
    })

    test("passes for multiple block locals in render", () => {
      expectNoOffenses(dedent`
        <%= render TableComponent.new do |table, index| %>
          <% table.with_header %>
          <% index.to_s %>
        <% end %>
      `)
    })

    test("passes for method calls on outer block local inside nested render block", () => {
      expectNoOffenses(dedent`
        <%= render LayoutComponent.new do |layout| %>
          <%= render CardComponent.new do |card| %>
            <% layout.with_sidebar %>
            <% card.with_header %>
          <% end %>
        <% end %>
      `)
    })

    test("passes for shovel operator", () => {
      expectNoOffenses(dedent`
        <% @items << item %>
        <% hello << "hello" %>
      `)
    })

    test("passes for mutation methods", () => {
      expectNoOffenses(dedent`
        <% @items.push(item) %>
        <% @items.append(item) %>
        <% @items.pop %>
        <% @items.shift %>
        <% @items.unshift(item) %>
        <% @items.delete(item) %>
        <% @items.clear %>
        <% @items.replace(other) %>
        <% @items.insert(0, item) %>
        <% @items.concat(other) %>
        <% @items.prepend(item) %>
      `)
    })

    test("passes for bang methods", () => {
      expectNoOffenses(dedent`
        <% @items.sort! %>
        <% @items.uniq! %>
        <% @items.compact! %>
        <% @items.flatten! %>
        <% @items.reverse! %>
        <% @items.reject! { |item| item.nil? } %>
      `)
    })

    test("passes for debug output calls (handled by erb-no-debug-output)", () => {
      expectNoOffenses(dedent`
        <% puts "hello" %>
        <% p @user %>
        <% pp @user %>
        <% print "debug" %>
        <% warn "message" %>
        <% debug @user %>
        <% byebug %>
        <% binding.pry %>
        <% binding.irb %>
      `)
    })
  })

  describe("invalid cases", () => {
    test("fails for bare method call on instance variable", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `@user.name` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% @user.name %>
      `)
    })

    test("fails for bare method call with arguments", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `helper_method(arg)` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% helper_method(arg) %>
      `)
    })

    test("fails for chained method calls", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `foo.bar.baz` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% foo.bar.baz %>
      `)
    })

    test("fails for bare instance variable read", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `@user` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% @user %>
      `)
    })

    test("fails for bare class variable read", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `@@count` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% @@count %>
      `)
    })

    test("fails for bare global variable read", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `$global` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% $global %>
      `)
    })

    test("fails for bare constant read", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `CONSTANT` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% CONSTANT %>
      `)
    })

    test("fails for bare constant path", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `Foo::Bar` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% Foo::Bar %>
      `)
    })

    test("fails for bare method call without receiver", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `some_method` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% some_method %>
      `)
    })

    test("fails for multiple unused expressions", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `@user.name` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )
      expectError(
        "Avoid unused expressions in silent ERB tags. `@title` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% @user.name %>
        <% @title %>
      `)
    })

    test("fails for method call on constant", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `User.count` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <% User.count %>
      `)
    })

    test("still fails for non-block-local calls inside render block", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `@user.name` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <%= render BlogComponent.new do |component| %>
          <% @user.name %>
        <% end %>
      `)
    })

    test("still fails for bare block local read inside render block", () => {
      expectError(
        "Avoid unused expressions in silent ERB tags. `component` is evaluated but its return value is discarded. Use `<%= ... %>` to output the value or remove the expression.",
      )

      assertOffenses(dedent`
        <%= render BlogComponent.new do |component| %>
          <% component %>
        <% end %>
      `)
    })
  })
})
