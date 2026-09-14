import { describe, test } from "vitest"

import { HTMLNoPositiveTabIndexRule } from "../../../src/rules/html-no-positive-tab-index.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(HTMLNoPositiveTabIndexRule)

describe("html-no-positive-tab-index in the browser", () => {
  test("passes for a tab index the page rendered as zero", () => {
    expectNoOffenses(`<div tabindex="0"></div>`)
  })

  test("fails for a positive tab index", () => {
    expectWarning(`Do not use positive \`tabindex\` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use \`tabindex="0"\` to make an element focusable or \`tabindex="-1"\` to remove it from the tab sequence.`)

    assertOffenses(`<div tabindex="3"></div>`)
  })
})
