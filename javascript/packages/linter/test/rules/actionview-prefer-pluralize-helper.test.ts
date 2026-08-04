import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewPreferPluralizeHelperRule } from "../../src/rules/actionview-prefer-pluralize-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(
  ActionViewPreferPluralizeHelperRule,
)

describe("ActionViewPreferPluralizeHelperRule", () => {
  describe("valid cases", () => {
    test("passes for the pluralize helper", () => {
      expectNoOffenses(dedent`
        <%= pluralize(aliases.size, "Known Alias") %>
      `)
    })

    test("passes for the pluralize helper mixed with text", () => {
      expectNoOffenses(dedent`
        Known <%= pluralize(aliases.size, "Alias") %>
      `)
    })

    test("passes for an isolated String#pluralize call", () => {
      expectNoOffenses(dedent`
        <%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("passes when the count receivers differ", () => {
      expectNoOffenses(dedent`
        <%= aliases.size %> <%= "Known Alias".pluralize(other.size) %>
      `)
    })

    test("passes when the count methods differ", () => {
      expectNoOffenses(dedent`
        <%= aliases.count %> <%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("passes when pluralize has a non-string receiver", () => {
      expectNoOffenses(dedent`
        <%= aliases.size %> <%= variable.pluralize(aliases.size) %>
      `)
    })

    test("passes for String#pluralize without a count", () => {
      expectNoOffenses(dedent`
        <%= "Alias".pluralize %>
      `)
    })

    test("does not match across another executable ERB node", () => {
      expectNoOffenses(dedent`
        <%= aliases.size %><% track(aliases) %><%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("does not match across an HTML element", () => {
      expectNoOffenses(dedent`
        <%= aliases.size %><span>Known</span><%= "Alias".pluralize(aliases.size) %>
      `)
    })
  })

  describe("invalid cases", () => {
    test("fails with no content between the paired output tags", () => {
      expectWarning(
        'Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.',
      )

      assertOffenses(dedent`
        <%= aliases.size %><%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("fails with whitespace between the paired output tags", () => {
      expectWarning(
        'Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.',
      )

      assertOffenses(dedent`
        <%= aliases.size %> <%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("includes intervening literal text in the suggested singular", () => {
      expectWarning(
        'Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.',
      )

      assertOffenses(dedent`
        <%= aliases.size %> Known <%= "Alias".pluralize(aliases.size) %>
      `)
    })

    test("supports length", () => {
      expectWarning(
        'Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(users.length, "User") %>` instead.',
      )

      assertOffenses(dedent`
        <%= users.length %> <%= "User".pluralize(users.length) %>
      `)
    })

    test("supports count", () => {
      expectWarning(
        'Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.count, "Record") %>` instead.',
      )

      assertOffenses(dedent`
        <%= records.count %> <%= "Record".pluralize(records.count) %>
      `)
    })

    test("matches structurally equivalent nested count expressions", () => {
      expectWarning(
        'Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(account.aliases(true).size, "Alias") %>` instead.',
      )

      assertOffenses(dedent`
        <%= account.aliases(true).size %> <%= "Alias".pluralize(account.aliases(true).size) %>
      `)
    })
  })
})
