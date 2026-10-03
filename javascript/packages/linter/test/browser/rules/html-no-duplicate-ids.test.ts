import { describe, test } from "vitest"

import { HTMLNoDuplicateIdsRule } from "../../../src/rules/html-no-duplicate-ids.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectError, assertOffenses } = createBrowserRuleTest(HTMLNoDuplicateIdsRule)

describe("html-no-duplicate-ids in the browser", () => {
  test("passes for two ids the page rendered distinct", () => {
    expectNoOffenses(`<p id="one"></p><p id="two"></p>`)
  })

  test("fails for the same id rendered twice, which one template cannot see", () => {
    expectError(`Duplicate ID \`note\` found. IDs must be unique within a document.`)

    assertOffenses(`<p id="note"></p><p id="note"></p>`)
  })
})
