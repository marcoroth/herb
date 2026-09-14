import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbStateRequiresSlotsRule } from "../../src/rules/herb-state-requires-slots.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbStateRequiresSlotsRule)

const MESSAGE = "`herb:state` declares client-owned state, but this template never opts into slots, so the states compile to nothing. Add `<%# herb:slots client %>` to park branch markup up front, or `<%# herb:slots server %>` to fetch it on demand."

describe("HerbStateRequiresSlotsRule", () => {
  test("allows a state declaration in a client-mode template", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:state (open: false) %>
      <div></div>
    `)
  })

  test("allows a state declaration in a server-mode template", () => {
    expectNoOffenses(dedent`
      <%# herb:slots server %>
      <%# herb:state (track: "") %>
      <li><%= track %></li>
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

  test("points at the first state directive", () => {
    expectError(MESSAGE)

    assertOffenses(dedent`
      <p>intro</p>
      <%# herb:state (open: false) %>
      <%# herb:state (count: 0) %>
      <div></div>
    `)
  })
})
