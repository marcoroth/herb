import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBPreferPluralizeHelperRule } from "../../src/rules/erb-prefer-pluralize-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBPreferPluralizeHelperRule)

describe("ERBPreferPluralizeHelperRule", () => {
  describe("valid cases", () => {
    test("passes for the pluralize helper", () => {
      expectNoOffenses(dedent`
        <%= pluralize("Known Alias", aliases.size) %>
      `)
    })

    test("passes for the pluralize helper mixed with text", () => {
      expectNoOffenses(dedent`
        Known <%= pluralize("Alias", aliases.size) %>
      `)
    })

    test("passes for String#pluralize without a count", () => {
      expectNoOffenses(dedent`
        <%= "Alias".pluralize %>
      `)
    })

    test("passes for pluralize on a non-string receiver", () => {
      expectNoOffenses(dedent`
        <%= model.pluralize(count) %>
      `)
    })

    test("passes for an unrelated method call on a string", () => {
      expectNoOffenses(dedent`
        <%= "Alias".upcase %>
      `)
    })
  })

  describe("invalid cases", () => {
    test("fails for String#pluralize with a count", () => {
      expectWarning('Prefer the `pluralize` helper over `String#pluralize` for counts. Use `<%= pluralize("Alias", aliases.size) %>` instead.')

      assertOffenses(dedent`
        <%= "Alias".pluralize(aliases.size) %>
      `)
    })

    test("fails for String#pluralize with a count mixed with text", () => {
      expectWarning('Prefer the `pluralize` helper over `String#pluralize` for counts. Use `<%= pluralize("Alias", aliases.size) %>` instead.')

      assertOffenses(dedent`
        <%= aliases.size %> Known <%= "Alias".pluralize(aliases.size) %>
      `)
    })

    test("fails for String#pluralize with an integer count", () => {
      expectWarning('Prefer the `pluralize` helper over `String#pluralize` for counts. Use `<%= pluralize("person", 2) %>` instead.')

      assertOffenses(dedent`
        <%= "person".pluralize(2) %>
      `)
    })

    test("fails for String#pluralize in a silent tag", () => {
      expectWarning('Prefer the `pluralize` helper over `String#pluralize` for counts. Use `<%= pluralize("Alias", count) %>` instead.')

      assertOffenses(dedent`
        <% "Alias".pluralize(count) %>
      `)
    })
  })
})
