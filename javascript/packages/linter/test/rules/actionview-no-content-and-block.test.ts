import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewNoContentAndBlockRule } from "../../src/rules/actionview-no-content-and-block.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoContentAndBlockRule)

describe("ActionViewNoContentAndBlockRule", () => {
  describe("valid cases", () => {
    test("tag helper with content argument only", () => {
      expectNoOffenses(`<%= tag.div "Hello" %>`)
    })

    test("tag helper with block only", () => {
      expectNoOffenses(dedent`
        <%= tag.div do %>
          Hello
        <% end %>
      `)
    })

    test("tag helper with keyword args and block", () => {
      expectNoOffenses(dedent`
        <%= tag.div class: "container" do %>
          Hello
        <% end %>
      `)
    })

    test("tag helper with inline block only", () => {
      expectNoOffenses(`<%= tag.div { "World" } %>`)
    })

    test("tag helper with inline block and data attributes", () => {
      expectNoOffenses(`<%= tag.div(data: { controller: "example" }) { "Hello" } %>`)
    })

    test("content_tag with tag name and block only", () => {
      expectNoOffenses(dedent`
        <%= content_tag :section do %>
          Welcome
        <% end %>
      `)
    })

    test("content_tag with tag name and content only", () => {
      expectNoOffenses(`<%= content_tag :section, "Welcome" %>`)
    })

    test("content_tag with tag name and inline block only", () => {
      expectNoOffenses(`<%= content_tag(:div) { "World" } %>`)
    })

    test("content_tag with inline block and data attributes", () => {
      expectNoOffenses(`<%= content_tag(:div, data: { controller: "example" }) { "Hello" } %>`)
    })

    test("link_to with content argument only", () => {
      expectNoOffenses(`<%= link_to "Dashboard", root_path %>`)
    })

    test("link_to with block only (URL argument)", () => {
      expectNoOffenses(dedent`
        <%= link_to root_path do %>
          Dashboard
        <% end %>
      `)
    })

    test("link_to with string URL and block is valid (first arg becomes URL)", () => {
      expectNoOffenses(`<%= link_to("hello") { "world" } %>`)
    })

    test("link_to with string URL and do block is valid", () => {
      expectNoOffenses(dedent`
        <%= link_to "/path" do %>
          Click here
        <% end %>
      `)
    })

    test("link_to with inline block and attributes", () => {
      expectNoOffenses(`<%= link_to("/about", class: "btn") { "About" } %>`)
    })

    test("link_to with inline block and data attributes", () => {
      expectNoOffenses(`<%= link_to("/profile", data: { turbo_method: "delete" }) { "Delete" } %>`)
    })

    test("button_tag with block only", () => {
      expectNoOffenses(dedent`
        <%= button_tag do %>
          Click me
        <% end %>
      `)
    })

    test("button_tag with content only", () => {
      expectNoOffenses(`<%= button_tag "Click me" %>`)
    })

    test("button_to with URL and block", () => {
      expectNoOffenses(dedent`
        <%= button_to "/path" do %>
          Click me
        <% end %>
      `)
    })

    test("button_to with content and URL only", () => {
      expectNoOffenses(`<%= button_to "Click me", "/path" %>`)
    })

    test("label_tag with field name and block", () => {
      expectNoOffenses(dedent`
        <%= label_tag "name" do %>
          Name
        <% end %>
      `)
    })

    test("label_tag with field name and label only", () => {
      expectNoOffenses(`<%= label_tag "name", "Your Name" %>`)
    })
  })

  describe("tag.* helpers", () => {
    test("tag.div with content and do block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `tag.div`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 12 },
      )

      assertOffenses(dedent`
        <%= tag.div "Hello" do %>
          World
        <% end %>
      `)
    })

    test("tag.span with content and do block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `tag.span`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 13 },
      )

      assertOffenses(dedent`
        <%= tag.span "Hello" do %>
          World
        <% end %>
      `)
    })

    test("tag.div with content and inline block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `tag.div`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 12 },
      )

      assertOffenses(`<%= tag.div("Hello") { "World" } %>`)
    })
  })

  describe("content_tag", () => {
    test("content_tag with content and do block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `content_tag`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 26 },
      )

      assertOffenses(dedent`
        <%= content_tag :section, "Intro" do %>
          Welcome
        <% end %>
      `)
    })

    test("content_tag with content and inline block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `content_tag`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 22 },
      )

      assertOffenses(`<%= content_tag(:div, "Hello") { "World" } %>`)
    })
  })

  describe("button_tag", () => {
    test("button_tag with content and do block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `button_tag`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 15 },
      )

      assertOffenses(dedent`
        <%= button_tag "Click" do %>
          Override
        <% end %>
      `)
    })

    test("button_tag with content and inline block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `button_tag`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 15 },
      )

      assertOffenses(`<%= button_tag("Click") { "Override" } %>`)
    })
  })

  describe("label_tag", () => {
    test("label_tag with label and do block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `label_tag`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 22 },
      )

      assertOffenses(dedent`
        <%= label_tag "name", "Label" do %>
          Override
        <% end %>
      `)
    })

    test("label_tag with label and inline block", () => {
      expectError(
        'Avoid passing both a content argument and a block to `label_tag`. The block content takes precedence and the argument is silently ignored.',
        { line: 1, column: 22 },
      )

      assertOffenses(`<%= label_tag("name", "Label") { "Override" } %>`)
    })
  })

  describe("link_to (arg shifting)", () => {
    test("link_to with content and do block causes runtime error", () => {
      expectError(
        'Avoid passing both a content argument and a block to `link_to`. When a block is given, arguments are shifted and the content argument is reinterpreted as the URL, which causes a runtime error.',
        { line: 1, column: 18 },
      )

      assertOffenses(dedent`
        <%= link_to "Go", root_path do %>
          Go now
        <% end %>
      `)
    })

    test("link_to with content and inline block causes runtime error", () => {
      expectError(
        'Avoid passing both a content argument and a block to `link_to`. When a block is given, arguments are shifted and the content argument is reinterpreted as the URL, which causes a runtime error.',
        { line: 1, column: 18 },
      )

      assertOffenses(`<%= link_to("Go", root_path) { "Go now" } %>`)
    })

    test("link_to with inline block is valid (single arg is URL)", () => {
      expectNoOffenses(`<%= link_to("/path") { "Click" } %>`)
    })
  })

  describe("button_to (arg shifting)", () => {
    test("button_to with content and do block causes runtime error", () => {
      expectError(
        'Avoid passing both a content argument and a block to `button_to`. When a block is given, arguments are shifted and the content argument is reinterpreted as the URL, which causes a runtime error.',
        { line: 1, column: 23 },
      )

      assertOffenses(dedent`
        <%= button_to "Click", "/path" do %>
          Override
        <% end %>
      `)
    })

    test("button_to with content and inline block causes runtime error", () => {
      expectError(
        'Avoid passing both a content argument and a block to `button_to`. When a block is given, arguments are shifted and the content argument is reinterpreted as the URL, which causes a runtime error.',
        { line: 1, column: 23 },
      )

      assertOffenses(`<%= button_to("Click", "/path") { "Override" } %>`)
    })

    test("button_to with inline block is valid (single arg is URL)", () => {
      expectNoOffenses(`<%= button_to("/path") { "Click" } %>`)
    })
  })
})
