import dedent from "dedent"

import { describe, test } from "vitest"

import { ActionViewNoHelperShadowingRule } from "../../src/rules/actionview-no-helper-shadowing.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, expectHint, assertOffenses } = createLinterTest(ActionViewNoHelperShadowingRule)

describe("ActionViewNoHelperShadowingRule", () => {
  describe("transformed helpers (error)", () => {
    test("block argument named tag is flagged as an error", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% @tags.each do |tag| %>
          <%= tag.name %>
        <% end %>
      `)
    })

    test("block argument named content_tag is flagged as an error", () => {
      expectError("Local variable `content_tag` shadows the Action View `content_tag` helper. Rename it to avoid confusion (for example `content_tag_item`).")

      assertOffenses(dedent`
        <% items.each do |content_tag| %>
          <%= content_tag %>
        <% end %>
      `)
    })

    test("only the shadowing argument is flagged in a multi-argument block", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% pairs.each do |key, tag| %>
          <%= key %>: <%= tag %>
        <% end %>
      `)
    })

    test("nested block shadowing is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% groups.each do |group| %>
          <% group.each do |tag| %>
            <%= tag.name %>
          <% end %>
        <% end %>
      `)
    })

    test("render block argument named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <%= render @tags do |tag| %>
          <%= tag.name %>
        <% end %>
      `)
    })

    test("for-loop variable named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% for tag in @tags %>
          <%= tag.name %>
        <% end %>
      `)
    })

    test("local assignment named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% tag = @tags.first %>
        <%= tag.name %>
      `)
    })

    test("multiple assignment target named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% first, tag = @tags %>
        <%= tag.name %>
      `)
    })

    test("or-assignment named link_to is flagged", () => {
      expectError("Local variable `link_to` shadows the Action View `link_to` helper. Rename it to avoid confusion (for example `link_to_item`).")

      assertOffenses(dedent`
        <% link_to ||= default_link %>
        <%= link_to %>
      `)
    })

    test("and-assignment named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% tag &&= @default_tag %>
        <%= tag.name %>
      `)
    })

    test("operator-assignment named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% tag += @extra %>
        <%= tag %>
      `)
    })

    test("for-loop with multiple targets flags only the shadowing target", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% for first, tag in @pairs %>
          <%= tag.name %>
        <% end %>
      `)
    })

    test("self-assignment flags the written variable once", () => {
      expectError("Local variable `link_to` shadows the Action View `link_to` helper. Rename it to avoid confusion (for example `link_to_item`).")

      assertOffenses(dedent`
        <% link_to = link_to("Home", root_path) %>
        <%= link_to %>
      `)
    })

    test("strict local named tag is flagged", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <%# locals: (tag:) %>
        <%= tag.name %>
      `)
    })
  })

  describe("non-transformed helpers (hint)", () => {
    test("block argument named label is flagged as a hint", () => {
      expectHint("Local variable `label` shadows the Action View `label` helper. Rename it to avoid confusion (for example `label_item`).")

      assertOffenses(dedent`
        <% @labels.each do |label| %>
          <%= label %>
        <% end %>
      `)
    })

    test("assignment named select is flagged as a hint", () => {
      expectHint("Local variable `select` shadows the Action View `select` helper. Rename it to avoid confusion (for example `select_item`).")

      assertOffenses(dedent`
        <% select = params[:select] %>
        <%= select %>
      `)
    })
  })

  describe("allowed", () => {
    test("calling a method named link_to on an object is allowed", () => {
      expectNoOffenses(dedent`
        <%= record.link_to %>
      `)
    })

    test("using the real link_to helper is allowed", () => {
      expectNoOffenses(dedent`
        <%= link_to "Home", root_path %>
      `)
    })

    test("using the real content_tag helper is allowed", () => {
      expectNoOffenses(dedent`
        <%= content_tag :div, "Hello" %>
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
        <% @tags.each do |group| %>
          <%= group.name %>
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

  describe("iteration blocks", () => {
    test("iteration block argument named tag is flagged as an error", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% @tags.map do |tag| %>
          <%= tag.name %>
        <% end %>
      `)
    })

    test("iteration block argument named label is flagged as a hint", () => {
      expectHint("Local variable `label` shadows the Action View `label` helper. Rename it to avoid confusion (for example `label_item`).")

      assertOffenses(dedent`
        <% @labels.each do |label| %>
          <%= label %>
        <% end %>
      `)
    })

    test("only the shadowing target is flagged in a multi-argument iteration block", () => {
      expectError("Local variable `tag` shadows the Action View `tag` helper. Rename it to avoid confusion (for example `tag_item`).")

      assertOffenses(dedent`
        <% @tags.each_with_index do |tag, index| %>
          <%= tag.name %>
        <% end %>
      `)
    })

    test("iteration block with a non-shadowing argument is allowed", () => {
      expectNoOffenses(dedent`
        <% @tags.each do |item| %>
          <%= item.name %>
        <% end %>
      `)
    })
  })
})
