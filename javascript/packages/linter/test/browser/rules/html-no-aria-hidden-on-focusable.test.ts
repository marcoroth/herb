import { describe, test } from "vitest"

import { HTMLNoAriaHiddenOnFocusableRule } from "../../../src/rules/html-no-aria-hidden-on-focusable.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(HTMLNoAriaHiddenOnFocusableRule)

describe("html-no-aria-hidden-on-focusable in the browser", () => {
  test("passes for aria-hidden on something not focusable", () => {
    expectNoOffenses(`<div aria-hidden="true"></div>`)
  })

  test("fails for aria-hidden on something the page left focusable", () => {
    expectWarning(`Elements that are focusable should not have \`aria-hidden="true"\` because it will cause confusion for assistive technology users.`)

    assertOffenses(`<button aria-hidden="true">x</button>`)
  })
})
