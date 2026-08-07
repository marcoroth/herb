import { beforeAll, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { UJSPreferTurboConfirmRule } from "../../src/rules/ujs-prefer-turbo-confirm.js"
import { UJSPreferTurboMethodRule } from "../../src/rules/ujs-prefer-turbo-method.js"
import { Linter } from "../../src/linter.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(UJSPreferTurboMethodRule)

const ATTRIBUTE_MESSAGE = "Avoid the deprecated `@rails/ujs` attribute `data-method`. Use `data-turbo-method` instead."
const OPTION_MESSAGE = "Avoid the deprecated `@rails/ujs` option, which renders `data-method`. Use `data: { turbo_method: ... }` instead."

describe("ujs-prefer-turbo-method", () => {
  describe("HTML attributes", () => {
    test("passes for elements without deprecated attributes", () => {
      expectNoOffenses(`<a href="/posts/1">Delete</a>`)
    })

    test("passes for the Turbo equivalent", () => {
      expectNoOffenses(`<a href="/posts/1" data-turbo-method="delete">Delete</a>`)
    })

    test("passes for a near-miss attribute name", () => {
      expectNoOffenses(`<a href="/posts/1" data-methods="delete" data-controller="confirm">Delete</a>`)
    })

    test("passes for the attributes owned by the sibling rules", () => {
      expectNoOffenses(`<a href="/posts/1" data-confirm="Sure?" data-disable-with="Saving..." data-remote="true">Delete</a>`)
    })

    test("fails for `data-method`", () => {
      expectWarning(ATTRIBUTE_MESSAGE, { line: 1, column: 19 })

      assertOffenses(`<a href="/posts/1" data-method="delete">Delete</a>`)
    })
  })

  describe("`link_to` helper", () => {
    test("passes for the Turbo equivalent", () => {
      expectNoOffenses(`<%= link_to "Delete", post_path(@post), data: { turbo_method: :delete } %>`)
    })

    test("fails for the `method:` option", () => {
      expectWarning(OPTION_MESSAGE, { line: 1, column: 40 })

      assertOffenses(`<%= link_to "Delete", post_path(@post), method: :delete %>`)
    })

    test("fails for the `data: { method: ... }` option", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to "Delete", post_path(@post), data: { method: :delete } %>`)
    })

    test("fails for the block form", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to post_path(@post), method: :delete do %>Delete<% end %>`)
    })

    test("fails for `link_to_if`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to_if cond, "Delete", post_path(@post), method: :delete %>`)
    })

    test("fails for `mail_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= mail_to "support@example.com", "Mail", method: :post %>`)
    })

    // `phone_to` and `sms_to` come from deriving the helper set off the Action View
    // registry rather than hardcoding it. They pass `html_options` straight through
    // to `link_to`, so a `method:` option on them renders `data-method` too.
    test("fails for `phone_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= phone_to "555-1234", "Call", method: :post %>`)
    })

    test("fails for `sms_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= sms_to "555-1234", "Text", method: :post %>`)
    })
  })

  describe("other Action View helpers", () => {
    test("passes for the `method:` option on `button_to`, which renders a real form", () => {
      expectNoOffenses(`<%= button_to "Delete", post_path(@post), method: :delete %>`)
    })

    test("passes for the `method:` option on `form_with`", () => {
      expectNoOffenses(`<%= form_with model: @post, method: :patch do |f| %><% end %>`)
    })

    test("passes for a `method:` keyword on a non-helper call", () => {
      expectNoOffenses(`<%= presenter.build(method: :delete) %>`)
    })

    test("passes for a `data:` hash nested in another option", () => {
      expectNoOffenses(`<%= render "form", locals: { data: { method: :delete } } %>`)
    })
  })

  describe("with the raw linter", () => {
    beforeAll(async () => {
      await Herb.load()
    })

    test("tags offenses as deprecated", () => {
      const linter = new Linter(Herb, [UJSPreferTurboMethodRule])
      const result = linter.lint(`<a href="/posts/1" data-method="delete">Delete</a>`)

      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].tags).toEqual(["deprecated"])
      expect(result.offenses[0].severity).toBe("warning")
    })

    test("reports the `method:` option only once", () => {
      const linter = new Linter(Herb, [UJSPreferTurboMethodRule])
      const result = linter.lint(`<%= link_to "Delete", post_path(@post), method: :delete %>`)

      expect(result.offenses).toHaveLength(1)
    })

    test("reports the `data: { method: ... }` option only once", () => {
      const linter = new Linter(Herb, [UJSPreferTurboMethodRule])
      const result = linter.lint(`<%= link_to "Delete", post_path(@post), data: { method: :delete } %>`)

      expect(result.offenses).toHaveLength(1)
    })

    test("each sibling UJS rule reports its own attribute", () => {
      const linter = new Linter(Herb, [UJSPreferTurboMethodRule, UJSPreferTurboConfirmRule])
      const result = linter.lint(`<a href="/posts/1" data-confirm="Are you sure?" data-method="delete">Delete</a>`)

      const byRule = Object.fromEntries(result.offenses.map(offense => [offense.rule, offense]))

      expect(result.offenses).toHaveLength(2)

      expect(byRule["ujs-prefer-turbo-confirm"].location.start.column).toBe(19)
      expect(byRule["ujs-prefer-turbo-method"].location.start.column).toBe(48)
    })
  })
})
