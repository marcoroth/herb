import { describe, test } from "vitest"

import { HTMLAnchorRequireHrefRule } from "../../../src/rules/html-anchor-require-href.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectError, assertOffenses } = createBrowserRuleTest(HTMLAnchorRequireHrefRule)

describe("html-anchor-require-href in the browser", () => {
  test("passes for an anchor the page rendered with an href", () => {
    expectNoOffenses(`<a href="/">Home</a>`)
  })

  test("fails for an anchor that rendered without one", () => {
    expectError(`Add an \`href\` attribute to \`<a>\` to ensure it is focusable and accessible. Links should navigate somewhere. If you need a clickable element without navigation, use a \`<button>\` instead.`)

    assertOffenses(`<a>Home</a>`)
  })
})
