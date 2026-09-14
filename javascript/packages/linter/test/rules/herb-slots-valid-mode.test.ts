import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbSlotsValidModeRule } from "../../src/rules/herb-slots-valid-mode.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbSlotsValidModeRule)

describe("HerbSlotsValidModeRule", () => {
  test("allows the client mode", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <div><%= @name %></div>
    `)
  })

  test("allows the server mode", () => {
    expectNoOffenses(dedent`
      <%# herb:slots server %>
      <div><%= @name %></div>
    `)
  })

  test("allows the bare directive", () => {
    expectNoOffenses(dedent`
      <%# herb:slots %>
      <div><%= @name %></div>
    `)
  })

  test("allows comments that are not the directive", () => {
    expectNoOffenses(dedent`
      <%# this template opts into herb:slots client further down %>
      <%# herb:slots client %>
      <div><%= @name %></div>
    `)
  })

  test("flags a misspelled mode", () => {
    expectError("`herb:slots clien` does not name a single mode, and the engine silently resolves it to `server`. Write `<%# herb:slots client %>` or `<%# herb:slots server %>`.")

    assertOffenses(dedent`
      <%# herb:slots clien %>
      <div><%= @name %></div>
    `)
  })

  test("flags a transposed mode", () => {
    expectError("`herb:slots cilent` does not name a single mode, and the engine silently resolves it to `server`. Write `<%# herb:slots client %>` or `<%# herb:slots server %>`.")

    assertOffenses(dedent`
      <%# herb:slots cilent %>
      <div><%= @name %></div>
    `)
  })

  test("flags two modes and names the one that wins", () => {
    expectError("`herb:slots client server` does not name a single mode, and the engine silently resolves it to `client`. Write `<%# herb:slots client %>` or `<%# herb:slots server %>`.")

    assertOffenses(dedent`
      <%# herb:slots client server %>
      <div><%= @name %></div>
    `)
  })

  test("flags an unknown token beside a mode", () => {
    expectError("`herb:slots clien client` does not name a single mode, and the engine silently resolves it to `client`. Write `<%# herb:slots client %>` or `<%# herb:slots server %>`.")

    assertOffenses(dedent`
      <%# herb:slots clien client %>
      <div><%= @name %></div>
    `)
  })
})
