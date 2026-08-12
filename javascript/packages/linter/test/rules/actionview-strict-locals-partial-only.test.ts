import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewStrictLocalsPartialOnlyRule } from "../../src/rules/actionview-strict-locals-partial-only.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ActionViewStrictLocalsPartialOnlyRule)

describe("ActionViewStrictLocalsPartialOnlyRule", () => {
  test("allows strict locals in partials", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `, { fileName: "_partial.html.erb" })
  })

  test("allows templates without strict locals", () => {
    expectNoOffenses(dedent`
      <div><%= user.name %></div>
    `, { fileName: "show.html.erb" })
  })

  test("flags strict locals in non-partial files", () => {
    expectWarning("Strict locals declarations are only supported in partials. This file is not a partial.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `, { fileName: "show.html.erb" })
  })

  test("flags strict locals in layout files", () => {
    expectWarning("Strict locals declarations are only supported in partials. This file is not a partial.")

    assertOffenses(dedent`
      <%# locals: (title:) %>

      <html>
        <head><title><%= title %></title></head>
      </html>
    `, { fileName: "application.html.erb" })
  })

  test("does not flag when filename is not provided", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `)
  })

  test("allows strict locals in nested partial paths", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `, { fileName: "app/views/users/_card.html.erb" })
  })

  test("flags strict locals in nested non-partial paths", () => {
    expectWarning("Strict locals declarations are only supported in partials. This file is not a partial.")

    assertOffenses(dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `, { fileName: "app/views/users/show.html.erb" })
  })

  test("flags strict locals in component files", () => {
    expectWarning("Strict locals declarations are only supported in partials. This file is not a partial.")

    assertOffenses(dedent`
      <%# locals: (title:) %>

      <div class="card"><%= title %></div>
    `, { fileName: "app/components/card_component.html.erb" })
  })

  test("flags strict locals not on the first line in non-partial files", () => {
    expectWarning("Strict locals declarations are only supported in partials. This file is not a partial.")

    assertOffenses(dedent`
      <div class="wrapper">
        <%# locals: (user:) %>
        <%= user.name %>
      </div>
    `, { fileName: "show.html.erb" })
  })
})
