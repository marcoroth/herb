import { describe, test } from "vitest"

import { HTMLNoDuplicateMetaNamesRule } from "../../../src/rules/html-no-duplicate-meta-names.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectError, assertOffenses } = createBrowserRuleTest(HTMLNoDuplicateMetaNamesRule)

describe("html-no-duplicate-meta-names in the browser", () => {
  test("passes for two meta names the page rendered distinct", () => {
    expectNoOffenses(`<meta name="description" content="a"><meta name="keywords" content="b">`)
  })

  test("fails for the same meta name rendered twice", () => {
    expectError(`Duplicate \`<meta>\` tag with \`name="description"\`. Meta names should be unique within the \`<head>\` section.`)

    assertOffenses(`<meta name="description" content="a"><meta name="description" content="b">`)
  })
})
