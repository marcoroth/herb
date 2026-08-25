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

    test("passes when String#pluralize has an additional locale argument", () => {
      expectNoOffenses(dedent`
        <%= users.size %> <%= "User".pluralize(users.size, :fr) %>
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
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.')

      assertOffenses(dedent`
        <%= aliases.size %><%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("fails with whitespace between the paired output tags", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.')

      assertOffenses(dedent`
        <%= aliases.size %> <%= "Known Alias".pluralize(aliases.size) %>
      `)
    })

    test("includes intervening literal text in the suggested singular", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.')

      assertOffenses(dedent`
        <%= aliases.size %> Known <%= "Alias".pluralize(aliases.size) %>
      `)
    })

    test("supports length", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(users.length, "User") %>` instead.')

      assertOffenses(dedent`
        <%= users.length %> <%= "User".pluralize(users.length) %>
      `)
    })

    test("supports count", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.count, "Record") %>` instead.')

      assertOffenses(dedent`
        <%= records.count %> <%= "Record".pluralize(records.count) %>
      `)
    })

    test("matches structurally equivalent nested count expressions", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(account.aliases(true).size, "Alias") %>` instead.')

      assertOffenses(dedent`
        <%= account.aliases(true).size %> <%= "Alias".pluralize(account.aliases(true).size) %>
      `)
    })

    test("supports an interpolated string receiver", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "#{kind}") %>` instead.')

      assertOffenses(dedent`
        <%= aliases.size %> <%= "#{kind}".pluralize(aliases.size) %>
      `)
    })

    test("preserves punctuation in the suggested singular", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.size, "/ Record") %>` instead.')

      assertOffenses(dedent`
        <%= records.size %> / <%= "Record".pluralize(records.size) %>
      `)
    })

    test("normalizes a tab between the paired output tags", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.size, "Known Record") %>` instead.')

      assertOffenses(
        `<%= records.size %>\tKnown <%= "Record".pluralize(records.size) %>`,
      )
    })

    test("normalizes a newline between the paired output tags", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.')

      assertOffenses(dedent`
        <%= aliases.size %>
        Known <%= "Alias".pluralize(aliases.size) %>
      `)
    })

    test("matches an indented pair inside an element", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known Alias") %>` instead.')

      assertOffenses(dedent`
        <div>
          <%= aliases.size %>
          Known <%= "Alias".pluralize(aliases.size) %>
        </div>
      `)
    })

    test("matches inside an if block", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Alias") %>` instead.')

      assertOffenses(dedent`
        <% if visible %>
          <%= aliases.size %> <%= "Alias".pluralize(aliases.size) %>
        <% end %>
      `)
    })

    test("matches inside an else branch", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Alias") %>` instead.')

      assertOffenses(dedent`
        <% if visible %>
        <% else %>
          <%= aliases.size %> <%= "Alias".pluralize(aliases.size) %>
        <% end %>
      `)
    })

    test("matches inside an iteration block", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(group.aliases.size, "Alias") %>` instead.')

      assertOffenses(dedent`
        <% groups.each do |group| %>
          <%= group.aliases.size %> <%= "Alias".pluralize(group.aliases.size) %>
        <% end %>
      `)
    })

    test("matches inside an unless block", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Alias") %>` instead.')

      assertOffenses(dedent`
        <% unless empty %>
          <%= aliases.size %> <%= "Alias".pluralize(aliases.size) %>
        <% end %>
      `)
    })

    test("preserves escape sequences in a double-quoted receiver", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.size, "Known Al\\tias") %>` instead.')

      assertOffenses(
        '<%= records.size %> Known <%= "Al\\tias".pluralize(records.size) %>',
      )
    })

    test("preserves a single-quoted receiver and its escapes", () => {
      expectWarning("Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.size, 'Known don\\'t') %>` instead.")

      assertOffenses(
        `<%= records.size %> Known <%= 'don\\'t'.pluralize(records.size) %>`,
      )
    })

    test("folds intervening text into an interpolated receiver", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(aliases.size, "Known #{kind}") %>` instead.')

      assertOffenses(`<%= aliases.size %> Known <%= "#{kind}".pluralize(aliases.size) %>`)
    })

    test("escapes quotes coming from the intervening text", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.size, "say \\"hi\\" Record") %>` instead.')

      assertOffenses(`<%= records.size %> say "hi" <%= "Record".pluralize(records.size) %>`)
    })

    test("escapes interpolation markers coming from the intervening text", () => {
      expectWarning('Prefer the `pluralize` helper over separate count and `String#pluralize` output. Use `<%= pluralize(records.size, "\\#{x} Record") %>` instead.')

      assertOffenses('<%= records.size %> #{x} <%= "Record".pluralize(records.size) %>')
    })
  })
})
