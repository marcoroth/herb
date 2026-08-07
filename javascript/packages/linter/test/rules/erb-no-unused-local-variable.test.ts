import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBNoUnusedLocalVariableRule } from "../../src/rules/erb-no-unused-local-variable.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnusedLocalVariableRule)

describe("erb-no-unused-local-variable", () => {
  test("passes for a local variable that is output later", () => {
    expectNoOffenses(dedent`
      <% number = posts.count %>

      New posts today: <%= number %>!
    `)
  })

  test("flags a local variable that is never used", () => {
    expectError("Local variable `number` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_number` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% number = posts.count %>

      New posts today: -
    `)
  })

  test("reports the offense on the variable name", () => {
    expectError("Local variable `number` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_number` to show it is intentionally unused.", [1, 3])

    assertOffenses(dedent`
      <% number = posts.count %>

      New posts today: -
    `)
  })

  test("passes for a local variable prefixed with an underscore", () => {
    expectNoOffenses(`<% _number = posts.count %>`)
  })

  test("flags every unused local variable", () => {
    expectError("Local variable `title` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_title` to show it is intentionally unused.")
    expectError("Local variable `subtitle` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_subtitle` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% title = "Posts" %>
      <% subtitle = "All of them" %>

      <h1>Posts</h1>
    `)
  })

  test("flags every assignment to the same unused local variable", () => {
    expectError("Local variable `title` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_title` to show it is intentionally unused.", [1, 3])
    expectError("Local variable `title` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_title` to show it is intentionally unused.", [2, 3])

    assertOffenses(dedent`
      <% title = "Posts" %>
      <% title = "Articles" %>
    `)
  })

  test("passes for a local variable used in an attribute value", () => {
    expectNoOffenses(dedent`
      <% css_class = "card card--wide" %>

      <div class="<%= css_class %>">Content</div>
    `)
  })

  test("passes for a local variable used inside a conditional branch", () => {
    expectNoOffenses(dedent`
      <% title = "Dashboard" %>

      <% if signed_in? %>
        <h1><%= title %></h1>
      <% end %>
    `)
  })

  test("passes for a local variable used inside a block", () => {
    expectNoOffenses(dedent`
      <% separator = ", " %>

      <% tags.each do |tag| %>
        <%= tag %><%= separator %>
      <% end %>
    `)
  })

  test("passes for a local variable used inside a case statement", () => {
    expectNoOffenses(dedent`
      <% label = "Draft" %>

      <% case post.status %>
      <% when :draft %>
        <%= label %>
      <% end %>
    `)
  })

  test("passes for a local variable used by a later assignment", () => {
    expectNoOffenses(dedent`
      <% first = post.title %>
      <% second = first.upcase %>

      <%= second %>
    `)
  })

  test("passes for a local variable that is only reassigned with an operator", () => {
    expectNoOffenses(dedent`
      <% total = 0 %>

      <% line_items.each do |line_item| %>
        <% total += line_item.amount %>
      <% end %>
    `)
  })

  test("passes for a local variable assigned with `||=`", () => {
    expectNoOffenses(`<% page_title ||= "Untitled" %>`)
  })

  test("passes for a local variable used in string interpolation", () => {
    expectNoOffenses(dedent`
      <% name = user.name %>

      <%= "Hello, #{name}!" %>
    `)
  })

  test("passes for a local variable used inside a captured block", () => {
    expectNoOffenses(dedent`
      <% heading = "Reports" %>

      <% content_for :header do %>
        <h1><%= heading %></h1>
      <% end %>
    `)
  })

  test("passes for a local variable passed as a partial local", () => {
    expectNoOffenses(dedent`
      <% highlighted = posts.first %>

      <%= render "posts/post", post: highlighted %>
    `)
  })

  test("flags a local variable assigned inside an output tag", () => {
    expectError("Local variable `number` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_number` to show it is intentionally unused.", [1, 4])

    assertOffenses(`<%= number = posts.count %>`)
  })

  test("flags a local variable assigned inside a conditional branch", () => {
    expectError("Local variable `title` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_title` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% if signed_in? %>
        <% title = "Dashboard" %>
      <% end %>

      <h1>Welcome</h1>
    `)
  })

  test("flags a local variable assigned inside a block", () => {
    expectError("Local variable `label` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_label` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% tags.each do |tag| %>
        <% label = tag.name %>
        <span>Tag</span>
      <% end %>
    `)
  })

  test("does not flag block arguments", () => {
    expectNoOffenses(dedent`
      <% tags.each do |tag| %>
        <span>Tag</span>
      <% end %>
    `)
  })

  test("does not flag multiple assignment targets", () => {
    expectNoOffenses(dedent`
      <% key, value = pair %>

      <%= key %>
    `)
  })

  test("does not flag a `for` loop variable", () => {
    expectNoOffenses(dedent`
      <% for tag in tags %>
        <span>Tag</span>
      <% end %>
    `)
  })

  test("does not flag a rescue variable", () => {
    expectNoOffenses(dedent`
      <% begin %>
        <%= render "posts/list" %>
      <% rescue => error %>
        <p>Something went wrong</p>
      <% end %>
    `)
  })

  test("does not flag a pattern matching binding", () => {
    expectNoOffenses(dedent`
      <% case payload %>
      <% in { name: String => name } %>
        <p>Matched</p>
      <% end %>
    `)
  })

  test("does not flag an instance variable assignment", () => {
    expectNoOffenses(`<% @number = posts.count %>`)
  })

  test("does not treat a mention inside an ERB comment as a use", () => {
    expectError("Local variable `number` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_number` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% number = posts.count %>
      <%# number is rendered by the layout %>
    `)
  })

  test("does not treat a mention inside a string as a use", () => {
    expectError("Local variable `number` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_number` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% number = posts.count %>

      <p>number</p>
    `)
  })

  test("does not treat a method with the same name as a use", () => {
    expectError("Local variable `count` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_count` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% count = posts.size %>

      <%= posts.count %>
    `)
  })

  test("does not treat an instance variable with the same name as a use", () => {
    expectError("Local variable `number` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_number` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% number = posts.count %>

      <%= @number %>
    `)
  })

  test("passes for a template without any Ruby", () => {
    expectNoOffenses(dedent`
      <div class="container">
        <h1>Posts</h1>
      </div>
    `)
  })

  test("passes for a local variable used inside a `<script>` tag", () => {
    expectNoOffenses(dedent`
      <% endpoint = posts_path %>

      <script>
        window.endpoint = "<%= endpoint %>";
      </script>
    `)
  })

  test("flags a local variable assigned inside a `<script>` tag", () => {
    expectError("Local variable `endpoint` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_endpoint` to show it is intentionally unused.")

    assertOffenses(dedent`
      <script>
        <% endpoint = posts_path %>
        window.endpoint = "/posts";
      </script>
    `)
  })

  test("passes for a local variable used inside a `<template>` tag", () => {
    expectNoOffenses(dedent`
      <% placeholder = "Loading" %>

      <template>
        <p><%= placeholder %></p>
      </template>
    `)
  })

  test("passes for a local variable used with trim markers", () => {
    expectNoOffenses(dedent`
      <%- greeting = "Hi" -%>
      <%= greeting -%>
    `)
  })

  test("flags an assignment in an argument list", () => {
    expectError("Local variable `size` is assigned but never used. This assignment sits in an argument list, where it still passes the value positionally. Write `size:` if you meant a keyword argument, or drop the `size =`.")

    assertOffenses(`<%= avatar_image(user, size = 40) %>`)
  })

  test("reports the offense on the name of an assignment in an argument list", () => {
    expectError("Local variable `size` is assigned but never used. This assignment sits in an argument list, where it still passes the value positionally. Write `size:` if you meant a keyword argument, or drop the `size =`.", [1, 23])

    assertOffenses(`<%= avatar_image(user, size = 40) %>`)
  })

  test("flags every assignment in an argument list", () => {
    expectError("Local variable `style` is assigned but never used. This assignment sits in an argument list, where it still passes the value positionally. Write `style:` if you meant a keyword argument, or drop the `style =`.")
    expectError("Local variable `classes` is assigned but never used. This assignment sits in an argument list, where it still passes the value positionally. Write `classes:` if you meant a keyword argument, or drop the `classes =`.")

    assertOffenses(`<%= follow_button(actor, style = "", classes = "w-100") %>`)
  })

  test("passes for a keyword argument", () => {
    expectNoOffenses(`<%= avatar_image(user, size: 40) %>`)
  })

  test("passes for an argument list assignment that is used later", () => {
    expectNoOffenses(dedent`
      <%= avatar_image(user, size = 40) %>
      <%= size %>
    `)
  })

  test("does not use the argument list advice for an assignment nested inside an argument", () => {
    expectError("Local variable `total` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_total` to show it is intentionally unused.")

    assertOffenses(`<%= summary(items.map { |item| total = item.amount }) %>`)
  })

  test("flags an assignment used only as a condition", () => {
    expectError("Local variable `visible` is assigned but never used. Remove the assignment, or prefix it with an underscore as `_visible` to show it is intentionally unused.")

    assertOffenses(dedent`
      <% if visible = post.published? %>
        <p>Published</p>
      <% end %>
    `)
  })
})
