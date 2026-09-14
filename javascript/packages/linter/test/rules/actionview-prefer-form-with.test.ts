import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewPreferFormWithRule } from "../../src/rules/actionview-prefer-form-with.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewPreferFormWithRule)

const MESSAGE = "Prefer the `form_with` helper over `form_for`, which the Rails guides no longer document and describe as discouraged. Pass the record to `form_with` as `model:`, and move an `as:` option to `scope:` and `html:` options to the top level."

describe("actionview-prefer-form-with", () => {
  test("passes for `form_with` with a model", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("passes for `form_with` with a namespaced model and a scope", () => {
    expectNoOffenses(dedent`
      <%= form_with model: [:admin, @user], scope: :customer do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("passes for `fields_for` nested inside `form_with`", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= form.fields_for :address do |address_form| %>
          <%= address_form.text_field :street %>
        <% end %>
      <% end %>
    `)
  })

  test("passes for a receiverless `fields_for`", () => {
    expectNoOffenses(dedent`
      <%= fields_for :address do |address_form| %>
        <%= address_form.text_field :street %>
      <% end %>
    `)
  })

  test("passes for `form_tag`", () => {
    expectNoOffenses(dedent`
      <%= form_tag session_path do %>
        <%= text_field_tag :email %>
      <% end %>
    `)
  })

  test("passes for `button_to`", () => {
    expectNoOffenses(`<%= button_to "Delete", @post, method: :delete %>`)
  })

  test("passes for a plain `<form>` element", () => {
    expectNoOffenses(dedent`
      <form action="/users" method="post">
        <input type="text" name="name">
      </form>
    `)
  })

  test("passes for a method whose name only starts with `form_for`", () => {
    expectNoOffenses(`<%= form_for_user @user %>`)
  })

  test("passes for `form_for` on a receiver", () => {
    expectNoOffenses(dedent`
      <%= helpers.form_for @user do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("passes for a local variable named `form_for`", () => {
    expectNoOffenses(dedent`
      <% form_for = "legacy" %>
      <p><%= form_for %></p>
    `)
  })

  test("passes for `form_for` inside an ERB comment", () => {
    expectNoOffenses(`<%# form_for @user do |form| %>`)
  })

  test("passes for `form_for` inside a string literal", () => {
    expectNoOffenses(`<%= "form_for @user" %>`)
  })

  test("passes for `form_for` in HTML text", () => {
    expectNoOffenses(`<p>Replace form_for with form_with</p>`)
  })

  test("flags `form_for` with a record", () => {
    expectInfo(MESSAGE, [1, 4])

    assertOffenses(dedent`
      <%= form_for @user do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("flags `form_for` with a namespaced record and an `as:` option", () => {
    expectInfo(MESSAGE)

    assertOffenses(dedent`
      <%= form_for [:admin, @user], as: :customer do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("flags `form_for` with `url:` and `html:` options", () => {
    expectInfo(MESSAGE)

    assertOffenses(dedent`
      <%= form_for @user, url: session_path, html: { class: "login" } do |form| %>
        <%= form.email_field :email %>
      <% end %>
    `)
  })

  test("flags `form_for` with parentheses", () => {
    expectInfo(MESSAGE)

    assertOffenses(dedent`
      <%= form_for(@user) do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("flags `form_for` in a silent ERB tag", () => {
    expectInfo(MESSAGE)

    assertOffenses(dedent`
      <% form_for @user do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("flags `form_for` nested inside a conditional", () => {
    expectInfo(MESSAGE, [2, 6])

    assertOffenses(dedent`
      <% if @user.persisted? %>
        <%= form_for @user do |form| %>
          <%= form.text_field :name %>
        <% end %>
      <% end %>
    `)
  })

  test("flags `form_for` inside an HTML element", () => {
    expectInfo(MESSAGE)

    assertOffenses(dedent`
      <div class="panel">
        <%= form_for @user do |form| %>
          <%= form.text_field :name %>
        <% end %>
      </div>
    `)
  })

  test("flags every `form_for` in a template", () => {
    expectInfo(MESSAGE, [1, 4])
    expectInfo(MESSAGE, [5, 4])

    assertOffenses(dedent`
      <%= form_for @user do |form| %>
        <%= form.text_field :name %>
      <% end %>

      <%= form_for @account do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("flags `form_for` nested inside another `form_for`", () => {
    expectInfo(MESSAGE, [1, 4])
    expectInfo(MESSAGE, [2, 6])

    assertOffenses(dedent`
      <%= form_for @user do |form| %>
        <%= form_for @account do |account_form| %>
          <%= account_form.text_field :name %>
        <% end %>
      <% end %>
    `)
  })
})
