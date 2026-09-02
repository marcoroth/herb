import { describe, test } from "vitest"

import { HTMLImgRequireAltRule } from "../../../src/rules/html-img-require-alt.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(HTMLImgRequireAltRule)

describe("html-img-require-alt in the browser", () => {
  test("passes for an img the page rendered with alt", () => {
    expectNoOffenses(`<img src="/logo.png" alt="Company logo">`)
  })

  test("fails for an img that rendered without one", () => {
    expectWarning(`Missing required \`alt\` attribute on \`<img>\` tag. Add \`alt=""\` for decorative images or \`alt="description"\` for informative images.`)

    assertOffenses(`<img src="/logo.png">`)
  })
})
