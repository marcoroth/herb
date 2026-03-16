import dedent from "dedent"

import { describe, test } from "vitest"

import { ActionViewNoSilentRenderRule } from "../../src/rules/actionview-no-silent-render.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoSilentRenderRule)

describe("ActionViewNoSilentRenderRule", () => {
  test("valid render with output tag", () => {
    expectNoOffenses(dedent`
      <%= render "shared/error" %>
    `)
  })

  test("valid render partial with output tag", () => {
    expectNoOffenses(dedent`
      <%= render partial: "comment", collection: @comments %>
    `)
  })

  test("valid render instance variable with output tag", () => {
    expectNoOffenses(dedent`
      <%= render @product %>
    `)
  })

  test("valid non-render silent tag", () => {
    expectNoOffenses(dedent`
      <% @products.each do |product| %>
      <% end %>
    `)
  })

  test("invalid render with silent tag", () => {
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <% render "shared/error" %>
    `)
  })

  test("invalid render partial with silent tag", () => {
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <% render partial: "comment", collection: @comments %>
    `)
  })

  test("invalid render instance variable with silent tag", () => {
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <% render @product %>
    `)
  })

  test("invalid render with trimming silent tag", () => {
    expectError("Avoid using `<%- %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <%- render "shared/error" -%>
    `)
  })

  test("multiple silent renders", () => {
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <% render "shared/header" %>
      <% render "shared/footer" %>
    `)
  })

  test("mixed valid and invalid renders", () => {
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <%= render "shared/header" %>
      <% render "shared/footer" %>
    `)
  })

  test("render with parentheses", () => {
    expectError("Avoid using `<% %>` with `render`. Use `<%= %>` to ensure the rendered content is output.")

    assertOffenses(dedent`
      <% render("shared/error") %>
    `)
  })
})
