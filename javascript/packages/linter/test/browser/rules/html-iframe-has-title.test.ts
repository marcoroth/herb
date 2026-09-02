import { describe, test } from "vitest"

import { HTMLIframeHasTitleRule } from "../../../src/rules/html-iframe-has-title.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(HTMLIframeHasTitleRule)

describe("html-iframe-has-title in the browser", () => {
  test("passes for an iframe the page rendered with a title", () => {
    expectNoOffenses(`<iframe src="/a" title="Report"></iframe>`)
  })

  test("fails for an iframe that rendered without one", () => {
    expectWarning(`\`<iframe>\` elements must have a \`title\` attribute that describes the content of the frame for screen reader users.`)

    assertOffenses(`<iframe src="/a"></iframe>`)
  })
})
