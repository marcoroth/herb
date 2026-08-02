import { describe, it } from "vitest"
import dedent from "dedent"

import { ERBPreferExplicitConditionalsRule } from "../../src/rules/erb-prefer-explicit-conditionals"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBPreferExplicitConditionalsRule)

describe("erb-prefer-explicit-conditionals", () => {
  it("flags an inline `if` in an output tag", () => {
    const html = dedent`
      <%= avatar_for(user) if user.avatar? %>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if user.avatar? %><%= avatar_for(user) %><% end %>` instead."
    )

    assertOffenses(html)
  })

  it("reports the offense on the whole ERB tag", () => {
    const html = dedent`
      <%= avatar_for(user) if user.avatar? %>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if user.avatar? %><%= avatar_for(user) %><% end %>` instead.",
      [1, 0]
    )

    assertOffenses(html)
  })

  it("flags an inline `unless` in an output tag", () => {
    const html = dedent`
      <%= badge unless user.admin? %>
    `

    expectError(
      "Prefer an explicit `<% unless %>` block over an inline `unless` condition. Use `<% unless user.admin? %><%= badge %><% end %>` instead."
    )

    assertOffenses(html)
  })

  it("flags an inline `if` inside an HTML element", () => {
    const html = dedent`
      <div>
        <%= icon(:check) if done? %>
      </div>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if done? %><%= icon(:check) %><% end %>` instead.",
      [2, 2]
    )

    assertOffenses(html)
  })

  it("flags an inline `if` inside an attribute value", () => {
    const html = dedent`
      <div class="<%= "active" if selected %>"></div>
    `

    expectError(
      'Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if selected %><%= "active" %><% end %>` instead.'
    )

    assertOffenses(html)
  })

  it("flags an inline `if` in attribute position", () => {
    const html = dedent`
      <a href="/" <%= 'aria-current=page' if selected %>>About</a>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if selected %><%= 'aria-current=page' %><% end %>` instead."
    )

    assertOffenses(html)
  })

  it("flags an inline `if` with a compound condition", () => {
    const html = dedent`
      <%= label if user.present? && user.admin? %>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if user.present? && user.admin? %><%= label %><% end %>` instead."
    )

    assertOffenses(html)
  })

  it("flags an inline `if` in a raw output tag", () => {
    const html = dedent`
      <%== markup if render_markup? %>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if render_markup? %><%== markup %><% end %>` instead."
    )

    assertOffenses(html)
  })

  it("does not flag an explicit `if` block", () => {
    const html = dedent`
      <% if user.avatar? %>
        <%= avatar_for(user) %>
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("does not flag an explicit `unless` block", () => {
    const html = dedent`
      <% unless user.admin? %>
        <%= badge %>
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("does not flag an explicit `if`/`else` block", () => {
    const html = dedent`
      <% if user.avatar? %>
        <%= avatar_for(user) %>
      <% else %>
        <%= placeholder %>
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("does not flag an inline `if` in a silent tag", () => {
    const html = dedent`
      <% redirect_to root_path if user.nil? %>
    `

    expectNoOffenses(html)
  })

  it("does not flag a ternary", () => {
    const html = dedent`
      <%= user.admin? ? admin_badge : user_badge %>
    `

    expectNoOffenses(html)
  })

  it("flags an inline `if` wrapping a ternary", () => {
    const html = dedent`
      <%= (user.admin? ? admin_badge : user_badge) if user %>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if user %><% if user.admin? %><%= admin_badge %><% else %><%= user_badge %><% end %><% end %>` instead."
    )

    assertOffenses(html)
  })

  it("does not flag an output tag without a condition", () => {
    const html = dedent`
      <%= avatar_for(user) %>
    `

    expectNoOffenses(html)
  })

  it("does not flag an ERB comment containing a postfix condition", () => {
    const html = dedent`
      <%# avatar_for(user) if user.avatar? %>
    `

    expectNoOffenses(html)
  })

  it("flags each inline conditional in a document", () => {
    const html = dedent`
      <%= icon(:check) if done? %>
      <%= badge unless user.admin? %>
    `

    expectError(
      "Prefer an explicit `<% if %>` block over an inline `if` condition. Use `<% if done? %><%= icon(:check) %><% end %>` instead.",
      [1, 0]
    )

    expectError(
      "Prefer an explicit `<% unless %>` block over an inline `unless` condition. Use `<% unless user.admin? %><%= badge %><% end %>` instead.",
      [2, 0]
    )

    assertOffenses(html)
  })
})
