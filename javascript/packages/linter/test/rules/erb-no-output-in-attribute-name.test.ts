import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoOutputInAttributeNameRule } from "../../src/rules/erb-no-output-in-attribute-name.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoOutputInAttributeNameRule)

const MESSAGE = "Avoid ERB output in attribute names. Use static attribute names with dynamic values instead."

describe("ERBNoOutputInAttributeNameRule", () => {
  describe("not allowed", () => {
    test("ERB output in attribute name", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div data-<%= key %>="value"></div>
      `)
    })

    // Parser rejects this: else/end cross the HTML scope boundary
    test.fails("ERB output if in attribute name is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div data-<%= if true? %>abc<% else %>def<% end %>="value"></div>
      `)
    })

    test("multiple ERB outputs in attribute names across elements", () => {
      expectError(MESSAGE)
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div data-<%= key1 %>="value1"></div>
        <span data-<%= key2 %>="value2"></span>
      `)
    })
  })

  describe("allowed", () => {
    test("static attribute names", () => {
      expectNoOffenses(dedent`
        <div class="container"></div>
        <input type="text" data-target="value">
      `)
    })

    test("ERB silent tag in attribute name is allowed", () => {
      expectNoOffenses(dedent`
        <div data-<% key %>-target="value"></div>
      `)
    })
  })
})
