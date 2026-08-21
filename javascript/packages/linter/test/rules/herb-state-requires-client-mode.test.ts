import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateRequiresClientModeRule } from "../../src/rules/herb-state-requires-client-mode.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateRequiresClientModeRule)

const MESSAGE = "`herb:state` declares client-owned state, but this template renders its slots in server mode, so no state can ever change anything. Add `<%# herb:slots client %>` so the branches a state drives are parked for the client."

describe("HerbStateRequiresClientModeRule", () => {
  test("allows a state declaration in a client-mode template", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:state (open: false) %>
      <div></div>
    `)
  })

  test("allows the directives in either order", () => {
    expectNoOffenses(dedent`
      <%# herb:state (open: false) %>
      <%# herb:slots client %>
      <div></div>
    `)
  })

  test("allows a template with no states at all", () => {
    expectNoOffenses(dedent`
      <div><%= @title %></div>
    `)
  })

  test("flags a state declaration with no slots directive", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <%# herb:state (open: false) %>
      <div></div>
    `)
  })

  test("flags a state declaration under an explicit server mode", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <%# herb:slots server %>
      <%# herb:state (open: false) %>
      <div></div>
    `)
  })

  test("flags a bare slots directive, which defaults to server", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <%# herb:slots %>
      <%# herb:state (open: false) %>
      <div></div>
    `)
  })

  test("reports once however many states are declared", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <%# herb:state (open: false, pending: false) %>
      <% @rows.each do |row| %>
        <%# herb:state (starred: false) %>
        <div></div>
      <% end %>
    `)
  })
})
