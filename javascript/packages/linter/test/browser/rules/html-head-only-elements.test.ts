import { describe, test } from "vitest"

import { HTMLHeadOnlyElementsRule } from "../../../src/rules/html-head-only-elements.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectError, assertOffenses } = createBrowserRuleTest(HTMLHeadOnlyElementsRule)

describe("html-head-only-elements in the browser", () => {
  test("passes for a body element where it belongs", () => {
    expectNoOffenses(`<div><p>fine</p></div>`)
  })

  test("fails for a head-only element the page rendered in the body", () => {
    expectError(`Element \`<title>\` must be placed inside the \`<head>\` tag.`)

    assertOffenses(`<div><title>misplaced</title></div>`)
  })
})
