import { describe, test } from "vitest"

import { A11yNestedInteractiveElementsRule } from "../../../src/rules/a11y-nested-interactive-elements.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectError, assertOffenses } = createBrowserRuleTest(A11yNestedInteractiveElementsRule)

describe("a11y-nested-interactive-elements in the browser", () => {
  test("passes for two interactive elements side by side", () => {
    expectNoOffenses(`<button>one</button><button>two</button>`)
  })

  test("fails for one interactive element inside another, which the parser keeps", () => {
    expectError(`Found \`<button>\` nested inside of \`<button>\`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.`)

    assertOffenses(`<button><button>inner</button></button>`)
  })
})
