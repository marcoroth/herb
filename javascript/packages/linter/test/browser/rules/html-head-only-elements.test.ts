import { describe, test } from "vitest"

import { HTMLHeadOnlyElementsRule } from "../../../src/rules/html-head-only-elements.js"
import { createBrowserRuleTest } from "../support/browser-rule-test.js"

const { expectNoOffenses, expectError, assertOffenses } = createBrowserRuleTest(HTMLHeadOnlyElementsRule)

describe("html-head-only-elements in the browser", () => {
  test("passes for a body element where it belongs", () => {
    expectNoOffenses(`<div><p>fine</p></div>`)
  })

  test("passes for a scoped style block, which the page renders in the body on purpose", () => {
    expectNoOffenses(`
      <style data-herb-style-scoped="data-herb-scope-2940ba8a">.card[data-herb-scope-2940ba8a] { color: red }</style>
      <div class="card" data-herb-scope-2940ba8a>Hi</div>
    `)
  })

  test("fails for a style block the page rendered in the body with no scope behind it", () => {
    expectError(`Element \`<style>\` must be placed inside the \`<head>\` tag.`)

    assertOffenses(`<div>content</div><style>.card { color: red }</style>`)
  })

  test("fails for a head-only element the page rendered in the body", () => {
    expectError(`Element \`<title>\` must be placed inside the \`<head>\` tag.`)

    assertOffenses(`<div><title>misplaced</title></div>`)
  })
})
