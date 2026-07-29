import dedent from "dedent"

import { describe, test } from "vitest"

import { ActionViewNoHelperShadowingRule } from "../../src/rules/actionview-no-helper-shadowing.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ActionViewNoHelperShadowingRule)

describe("ActionViewNoHelperShadowingRule", () => {
  test("block argument named tag is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <% @tags.each do |tag| %>
        <%= tag.name %>
      <% end %>
    `)
  })

  test("block argument named content_tag is flagged", () => {
    expectWarning("Local variable `content_tag` shadows the Action View `content_tag` helper. Rename it to avoid confusion (for example `content_tag_item`).")

    assertOffenses(dedent`
      <% items.each do |content_tag| %>
        <%= content_tag %>
      <% end %>
    `)
  })

  test("only the shadowing argument is flagged in a multi-argument block", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <% pairs.each do |key, tag| %>
        <%= key %>: <%= tag %>
      <% end %>
    `)
  })

  test("nested block shadowing is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <% groups.each do |group| %>
        <% group.each do |tag| %>
          <%= tag.name %>
        <% end %>
      <% end %>
    `)
  })

  test("render block argument named tag is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <%= render @tags do |tag| %>
        <%= tag.name %>
      <% end %>
    `)
  })

  test("for-loop variable named tag is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <% for tag in @tags %>
        <%= tag.name %>
      <% end %>
    `)
  })

  test("local assignment named tag is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <% tag = @tags.first %>
      <%= tag.name %>
    `)
  })

  test("multiple assignment target named tag is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <% first, tag = @tags %>
      <%= tag.name %>
    `)
  })

  test("or-assignment named link_to is flagged", () => {
    expectWarning("Local variable `link_to` shadows the Action View `link_to` helper. Rename it to avoid confusion (for example `link_to_item`).")

    assertOffenses(dedent`
      <% link_to ||= default_link %>
      <%= link_to %>
    `)
  })

  test("strict local named tag is flagged", () => {
    expectWarning("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

    assertOffenses(dedent`
      <%# locals: (tag:) %>
      <%= tag.name %>
    `)
  })

  test("calling a method named link_to on an object is allowed", () => {
    expectNoOffenses(dedent`
      <%= record.link_to %>
    `)
  })

  test("using the real tag helper is allowed", () => {
    expectNoOffenses(dedent`
      <%= tag.div do %>
        Content
      <% end %>
    `)
  })

  test("non-shadowing block argument is allowed", () => {
    expectNoOffenses(dedent`
      <% @tags.each do |t| %>
        <%= t.name %>
      <% end %>
    `)
  })

  test("block without arguments is allowed", () => {
    expectNoOffenses(dedent`
      <% loop do %>
        <%= tag.br %>
      <% end %>
    `)
  })
})
