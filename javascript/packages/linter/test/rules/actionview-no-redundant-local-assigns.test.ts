import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewNoRedundantLocalAssignsRule } from "../../src/rules/actionview-no-redundant-local-assigns.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoRedundantLocalAssignsRule)

describe("actionview-no-redundant-local-assigns", () => {
  test("flags reading a required local back out of local_assigns", () => {
    expectError("Strict local `user` is already a local variable in this partial, so `local_assigns[:user]` reads back a value that is already in scope. Use `user` instead.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns[:user].name %>
    `)
  })

  test("reports the offense on the lookup", () => {
    expectError("Strict local `user` is already a local variable in this partial, so `local_assigns[:user]` reads back a value that is already in scope. Use `user` instead.", [3, 4])

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns[:user].name %>
    `)
  })

  test("flags fetching a required local from local_assigns", () => {
    expectError("Strict local `user` is already a local variable in this partial, so `local_assigns.fetch(:user)` reads back a value that is already in scope. Use `user` instead.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns.fetch(:user) %>
    `)
  })

  test("mentions the extra argument when fetching with a default", () => {
    expectError("Strict local `user` is already a local variable in this partial, so `local_assigns.fetch(:user, ...)` reads back a value that is already in scope. Use `user` instead.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns.fetch(:user, "Anonymous") %>
    `)
  })

  test("flags digging a required local out of local_assigns", () => {
    expectError("Strict local `user` is already a local variable in this partial, so `local_assigns.dig(:user)` reads back a value that is already in scope. Use `user` instead.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns.dig(:user) %>
    `)
  })

  test("flags a presence check for a required local", () => {
    expectError("Strict local `user` is required, so `local_assigns.key?(:user)` is always `true`. Remove the condition, or give `user` a default value to make it optional.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <% if local_assigns.key?(:user) %>
        <%= user.name %>
      <% end %>
    `)
  })

  test("flags every presence check alias", () => {
    expectError("Strict local `user` is required, so `local_assigns.has_key?(:user)` is always `true`. Remove the condition, or give `user` a default value to make it optional.")
    expectError("Strict local `user` is required, so `local_assigns.include?(:user)` is always `true`. Remove the condition, or give `user` a default value to make it optional.")
    expectError("Strict local `user` is required, so `local_assigns.member?(:user)` is always `true`. Remove the condition, or give `user` a default value to make it optional.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns.has_key?(:user) %>
      <%= local_assigns.include?(:user) %>
      <%= local_assigns.member?(:user) %>
    `)
  })

  test("flags a lookup for an undeclared local", () => {
    expectError("`size` is not declared in the `locals:` declaration, so Rails raises if a caller passes it and `local_assigns.fetch(:size, ...)` can never find it. Declare `size:` in the declaration, or remove the lookup.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns.fetch(:size, "large") %>
    `)
  })

  test("flags a presence check for an undeclared local", () => {
    expectError("`size` is not declared in the `locals:` declaration, so Rails raises if a caller passes it and `local_assigns.key?(:size)` can never find it. Declare `size:` in the declaration, or remove the lookup.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <% if local_assigns.key?(:size) %>
        <span>sized</span>
      <% end %>
    `)
  })

  test("flags a lookup against an empty declaration", () => {
    expectError("`user` is not declared in the `locals:` declaration, so Rails raises if a caller passes it and `local_assigns[:user]` can never find it. Declare `user:` in the declaration, or remove the lookup.")

    assertOffenses(dedent`
      <%# locals: () %>

      <%= local_assigns[:user] %>
    `)
  })

  test("does not flag a partial that reads its locals directly", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <%= user.name %>
    `)
  })

  test("does not flag a presence check for an optional local", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, size: nil) %>

      <%= user.name %>
      <% if local_assigns.key?(:size) %>
        <span><%= size %></span>
      <% end %>
    `)
  })

  test("does not flag reading an optional local from local_assigns", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, size: nil) %>

      <%= user.name %>
      <%= local_assigns[:size] %>
    `)
  })

  test("does not flag forwarding every local", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <%= render "row", **local_assigns %>
    `)
  })

  test("does not flag any lookup when the declaration has a keyword rest", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, **) %>

      <%= user.name %>
      <%= local_assigns.fetch(:size, "large") %>
    `)
  })

  test("does not flag any lookup when the declaration has a named keyword rest", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, **options) %>

      <%= user.name %>
      <%= local_assigns.fetch(:size, "large") %>
    `)
  })

  test("does not flag partials without a strict locals declaration", () => {
    expectNoOffenses(dedent`
      <%= local_assigns[:user] %>
      <%= local_assigns.fetch(:size, "large") %>
      <% if local_assigns.key?(:user) %>
        <span>named</span>
      <% end %>
    `)
  })

  test("does not flag a lookup with a non-symbol key", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, key:) %>

      <%= local_assigns[key] %>
      <%= user.name %>
    `)
  })

  test("does not flag a nested dig through more than one key", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <%= user.name %>
      <%= local_assigns.dig(:user, :name) %>
    `)
  })

  test("does not flag lookups on something other than local_assigns", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, options:) %>

      <%= user.name %>
      <%= options[:user] %>
      <%= options.fetch(:size, "large") %>
    `)
  })

  test("does not run for non-partial files", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns[:user].name %>
    `, { fileName: "show.html.erb" })
  })

  test("runs for partial files", () => {
    expectError("Strict local `user` is already a local variable in this partial, so `local_assigns[:user]` reads back a value that is already in scope. Use `user` instead.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <%= local_assigns[:user].name %>
    `, { fileName: "app/views/users/_card.html.erb" })
  })
})
