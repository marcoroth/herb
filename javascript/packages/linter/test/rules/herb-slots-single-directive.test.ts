import dedent from "dedent"
import { describe, test } from "vitest"
import { HerbSlotsSingleDirectiveRule } from "../../src/rules/herb-slots-single-directive.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbSlotsSingleDirectiveRule)

const message = (mode: string, line: number) => `This template already declares \`herb:slots ${mode}\` on line ${line}, and the engine reads only the first directive, so this one does nothing. Remove it, and put the mode the template should use on the first directive.`

describe("herb-slots-single-directive", () => {
  test("allows a single client directive", () => {
    expectNoOffenses(dedent`
      <%# herb:slots client %>
      <div><%= @title %></div>
    `)
  })

  test("allows a single server directive", () => {
    expectNoOffenses(dedent`
      <%# herb:slots server %>
      <div><%= @title %></div>
    `)
  })

  test("allows a template without any directive", () => {
    expectNoOffenses(dedent`
      <div><%= @title %></div>
    `)
  })

  test("flags a second directive, naming the one that wins", () => {
    expectError(message("client", 1))

    assertOffenses(dedent`
      <%# herb:slots client %>
      <div><%= @title %></div>
      <%# herb:slots server %>
    `)
  })

  test("flags a duplicate even when both name the same mode", () => {
    expectError(message("server", 1))

    assertOffenses(dedent`
      <%# herb:slots server %>
      <%# herb:slots server %>
      <div><%= @title %></div>
    `)
  })

  test("flags every directive after the first", () => {
    expectError(message("client", 1))
    expectError(message("client", 1))

    assertOffenses(dedent`
      <%# herb:slots client %>
      <%# herb:slots server %>
      <%# herb:slots client %>
      <div><%= @title %></div>
    `)
  })
})
