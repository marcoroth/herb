import { describe, test } from "vitest"

import { HTMLNoEmptyHeadingsRule } from "../../../src/rules/html-no-empty-headings.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(HTMLNoEmptyHeadingsRule)

describe("html-no-empty-headings in the browser", () => {
  test("passes for a heading the page rendered with text", () => {
    expectNoOffenses(`<h1>Title</h1>`)
  })

  test("fails for a heading that rendered empty", () => {
    expectWarning(`Heading element \`<h1>\` must not be empty. Provide accessible text content for screen readers and SEO.`)

    assertOffenses(`<h1></h1>`)
  })
})
