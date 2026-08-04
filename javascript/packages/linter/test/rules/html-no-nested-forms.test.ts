import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoNestedFormsRule } from "../../src/rules/html-no-nested-forms.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoNestedFormsRule)

describe("html-no-nested-forms", () => {
  test("passes for sibling forms", () => {
    expectNoOffenses(dedent`
      <form><input type="text" name="name"></form>
      <form><input type="text" name="email"></form>
    `)
  })

  test("fails for directly nested forms", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")

    assertOffenses(dedent`
      <form>
        <input type="text" name="name">
        <form><input type="text" name="nested"></form>
      </form>
    `)
  })

  test("fails for indirectly nested forms", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")

    assertOffenses(dedent`
      <form>
        <div><section><form><input type="text" name="nested"></form></section></div>
      </form>
    `)
  })

  test("fails for multiple levels of nesting", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")

    assertOffenses(dedent`
      <form><form><form></form></form></form>
    `)
  })

  test("handles mixed case form tags", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")

    assertOffenses(dedent`
      <form><FORM></FORM></form>
    `)
  })

  test("passes for sibling form_with blocks", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= form.submit %>
      <% end %>
      <%= form_with model: @company do |form| %>
        <%= form.submit %>
      <% end %>
    `)
  })

  test("passes for button_to outside of a form", () => {
    expectNoOffenses(dedent`
      <%= button_to "Delete", mission_path(@mission), method: :delete %>
    `)
  })

  test("passes for fields_for inside form_with", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= fields_for :address do |address_fields| %>
          <%= address_fields.text_field :street %>
        <% end %>
      <% end %>
    `)
  })

  test("fails for form_with nested inside form_with", () => {
    expectError("`form_with` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <%= form_with model: @user do |user_form| %>
        <%= form_with model: @address do |address_form| %>
          <%= address_form.text_field :street %>
        <% end %>
      <% end %>
    `)
  })

  test("fails for button_to inside form_with", () => {
    expectError("`button_to` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <%= form_with model: @mission do |form| %>
        <%= form.submit "Update" %>
        <%= button_to "Delete", mission_path(@mission), method: :delete %>
      <% end %>
    `)
  })

  test("fails for button_to with a block inside form_with", () => {
    expectError("`button_to` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <%= form_with model: @mission do |form| %>
        <%= button_to mission_path(@mission), method: :delete do %>Delete<% end %>
      <% end %>
    `)
  })

  test("fails for button_to inside a form element", () => {
    expectError("`button_to` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <form action="/missions" method="post">
        <%= button_to "Delete", mission_path(@mission), method: :delete %>
      </form>
    `)
  })

  test("fails for a form element inside form_with", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")

    assertOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <form><input type="text" name="nested"></form>
      <% end %>
    `)
  })

  test("fails for form_tag inside form_with", () => {
    expectError("`form_tag` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= form_tag "/search" do %>
          <%= submit_tag "Search" %>
        <% end %>
      <% end %>
    `)
  })

  test("passes for sibling form_tag blocks", () => {
    expectNoOffenses(dedent`
      <%= form_tag "/search" do %>
        <%= submit_tag "Search" %>
      <% end %>
      <%= form_tag "/filter" do %>
        <%= submit_tag "Filter" %>
      <% end %>
    `)
  })

  test("fails for form_tag nested inside form_tag", () => {
    expectError("`form_tag` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <%= form_tag "/search" do %>
        <%= form_tag "/filter" do %>
          <%= submit_tag "Filter" %>
        <% end %>
      <% end %>
    `)
  })

  test("fails for button_to inside form_tag", () => {
    expectError("`button_to` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <%= form_tag "/missions" do %>
        <%= submit_tag "Update" %>
        <%= button_to "Delete", mission_path(@mission), method: :delete %>
      <% end %>
    `)
  })

  test("fails for a form element inside form_tag", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.")

    assertOffenses(dedent`
      <%= form_tag "/search" do %>
        <form><input type="text" name="nested"></form>
      <% end %>
    `)
  })

  test("fails for form_tag nested inside a form element", () => {
    expectError("`form_tag` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <form action="/missions" method="post">
        <%= form_tag "/search" do %>
          <%= submit_tag "Search" %>
        <% end %>
      </form>
    `)
  })

  test("fails for form_for nested inside a form element", () => {
    expectError("`form_for` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.")

    assertOffenses(dedent`
      <form action="/users" method="post">
        <%= form_for @user do |form| %>
          <%= form.submit %>
        <% end %>
      </form>
    `)
  })

  test("passes for helper calls that are not form helpers inside a form", () => {
    expectNoOffenses(dedent`
      <form action="/search">
        <%= text_field_tag :query %>
        <%= link_to "Cancel", root_path %>
      </form>
    `)
  })

  test("passes for escaped ERB form helper inside a form", () => {
    expectNoOffenses(dedent`
      <form action="/examples">
        <%%= button_to "Delete", mission_path(@mission), method: :delete %>
      </form>
    `)
  })

  test("reports the nested form location", () => {
    expectError("Nested `<form>` elements are not allowed. Move the inner `<form>` outside of the enclosing `<form>`, or associate its controls using the `form` attribute.", [1, 12])

    assertOffenses(dedent`
      <form><div><form></form></div></form>
    `)
  })
})
