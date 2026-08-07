import { beforeAll, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { UJSPreferTurboSubmitsWithRule } from "../../src/rules/ujs-prefer-turbo-submits-with.js"
import { Linter } from "../../src/linter.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(UJSPreferTurboSubmitsWithRule)

const ATTRIBUTE_MESSAGE = "Avoid the deprecated `@rails/ujs` attribute `data-disable-with`. Use `data-turbo-submits-with` instead."
const OPTION_MESSAGE = "Avoid the deprecated `@rails/ujs` option, which renders `data-disable-with`. Use `data: { turbo_submits_with: ... }` instead."

describe("ujs-prefer-turbo-submits-with", () => {
  describe("HTML attributes", () => {
    test("passes for the Turbo equivalent", () => {
      expectNoOffenses(`<button data-turbo-submits-with="Saving...">Save</button>`)
    })

    test("passes for a near-miss attribute name", () => {
      expectNoOffenses(`<button data-disable="true" disabled>Save</button>`)
    })

    test("passes for the attributes owned by the sibling rules", () => {
      expectNoOffenses(`<a href="/posts/1" data-method="delete" data-confirm="Sure?" data-remote="true">Delete</a>`)
    })

    test("fails for `data-disable-with`", () => {
      expectWarning(ATTRIBUTE_MESSAGE, { line: 1, column: 8 })

      assertOffenses(`<button data-disable-with="Saving...">Save</button>`)
    })
  })

  describe("Action View helpers", () => {
    test("passes for the Turbo equivalent", () => {
      expectNoOffenses(`<%= f.submit "Save", data: { turbo_submits_with: "Saving..." } %>`)
    })

    test("fails for `data: { disable_with: ... }` on a form builder", () => {
      expectWarning(OPTION_MESSAGE, { line: 2, column: 31 })

      assertOffenses(`<%= form_with model: @post do |f| %>\n  <%= f.submit "Save", data: { disable_with: "Saving..." } %>\n<% end %>`)
    })

    test("fails for `data: { disable_with: ... }` on `submit_tag`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= submit_tag "Save", data: { disable_with: "Saving..." } %>`)
    })

    test("fails for `data: { disable_with: ... }` on `button_tag`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= button_tag "Save", data: { disable_with: "Saving..." } %>`)
    })

    test("passes for a `data:` hash nested in another option", () => {
      expectNoOffenses(`<%= render "form", locals: { data: { disable_with: "Saving..." } } %>`)
    })
  })

  describe("with the raw linter", () => {
    beforeAll(async () => {
      await Herb.load()
    })

    test("tags offenses as deprecated", () => {
      const linter = new Linter(Herb, [UJSPreferTurboSubmitsWithRule])
      const result = linter.lint(`<button data-disable-with="Saving...">Save</button>`)

      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].tags).toEqual(["deprecated"])
      expect(result.offenses[0].severity).toBe("warning")
    })

    test("tags helper option offenses as deprecated", () => {
      const linter = new Linter(Herb, [UJSPreferTurboSubmitsWithRule])
      const result = linter.lint(`<%= submit_tag "Save", data: { disable_with: "Saving..." } %>`)

      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].tags).toEqual(["deprecated"])
    })
  })
})
