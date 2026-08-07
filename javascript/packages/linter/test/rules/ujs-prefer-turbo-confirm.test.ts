import { beforeAll, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { UJSPreferTurboConfirmRule } from "../../src/rules/ujs-prefer-turbo-confirm.js"
import { Linter } from "../../src/linter.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(UJSPreferTurboConfirmRule)

const ATTRIBUTE_MESSAGE = "Avoid the deprecated `@rails/ujs` attribute `data-confirm`. Use `data-turbo-confirm` instead."
const OPTION_MESSAGE = "Avoid the deprecated `@rails/ujs` option, which renders `data-confirm`. Use `data: { turbo_confirm: ... }` instead."

describe("ujs-prefer-turbo-confirm", () => {
  describe("HTML attributes", () => {
    test("passes for the Turbo equivalent", () => {
      expectNoOffenses(`<a href="/posts/1" data-turbo-confirm="Are you sure?">Delete</a>`)
    })

    test("passes for a near-miss attribute name", () => {
      expectNoOffenses(`<a href="/posts/1" data-confirmation="Are you sure?">Delete</a>`)
    })

    test("passes for the attributes owned by the sibling rules", () => {
      expectNoOffenses(`<a href="/posts/1" data-method="delete" data-disable-with="Saving..." data-remote="true">Delete</a>`)
    })

    test("fails for `data-confirm`", () => {
      expectWarning(ATTRIBUTE_MESSAGE, { line: 1, column: 19 })

      assertOffenses(`<a href="/posts/1" data-confirm="Are you sure?">Delete</a>`)
    })

    test("fails for an uppercase attribute name", () => {
      expectWarning(ATTRIBUTE_MESSAGE)

      assertOffenses(`<a href="/posts/1" DATA-CONFIRM="Are you sure?">Delete</a>`)
    })
  })

  describe("Action View helpers", () => {
    test("passes for the Turbo equivalent", () => {
      expectNoOffenses(`<%= link_to "Delete", post_path(@post), data: { turbo_confirm: "Are you sure?" } %>`)
    })

    test("fails for `data: { confirm: ... }` on `link_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to "Delete", post_path(@post), data: { confirm: "Are you sure?" } %>`)
    })

    test("fails for `data: { confirm: ... }` on `button_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= button_to "Delete", post_path(@post), data: { confirm: "Are you sure?" } %>`)
    })

    test("fails for a dynamic value", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to "Delete", post_path(@post), data: { confirm: t(".sure") } %>`)
    })

    test("passes for a `data:` hash nested in another option", () => {
      expectNoOffenses(`<%= render "form", locals: { data: { confirm: "Are you sure?" } } %>`)
    })
  })

  describe("with the raw linter", () => {
    beforeAll(async () => {
      await Herb.load()
    })

    test("tags offenses as deprecated", () => {
      const linter = new Linter(Herb, [UJSPreferTurboConfirmRule])
      const result = linter.lint(`<a href="/posts/1" data-confirm="Are you sure?">Delete</a>`)

      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].tags).toEqual(["deprecated"])
      expect(result.offenses[0].severity).toBe("warning")
    })

    test("reports the option only once", () => {
      const linter = new Linter(Herb, [UJSPreferTurboConfirmRule])
      const result = linter.lint(`<%= link_to "Delete", post_path(@post), data: { confirm: "Are you sure?" } %>`)

      expect(result.offenses).toHaveLength(1)
    })
  })
})
