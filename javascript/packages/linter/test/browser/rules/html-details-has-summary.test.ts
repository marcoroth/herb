import { describe, test } from "vitest"

import { HTMLDetailsHasSummaryRule } from "../../../src/rules/html-details-has-summary.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(HTMLDetailsHasSummaryRule)

describe("html-details-has-summary in the browser", () => {
  test("passes for details the page rendered with a summary", () => {
    expectNoOffenses(`<details><summary>More</summary><p>x</p></details>`)
  })

  test("fails for details that rendered without one", () => {
    expectWarning(`\`<details>\` element must have a direct \`<summary>\` child element.`)

    assertOffenses(`<details><p>x</p></details>`)
  })
})
