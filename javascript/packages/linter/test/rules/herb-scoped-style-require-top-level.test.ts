import dedent from "dedent"
import { describe, test } from "vitest"

import { HerbScopedStyleRequireTopLevelRule } from "../../src/rules/herb-scoped-style-require-top-level.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbScopedStyleRequireTopLevelRule)

describe("herb-scoped-style-require-top-level", () => {
  test("passes with a top-level scoped block", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .a { color: red; }
      </style>

      <div>Hi</div>
    `)
  })

  test("passes with no scoped block", () => {
    expectNoOffenses("<div><style>.a { color: red; }</style></div>")
  })

  test("passes a nested plain style block", () => {
    expectNoOffenses("<div><style>.a { color: red; }</style></div>")
  })

  test("fails on a nested scoped block", () => {
    expectWarning("A `<style scoped>` block styles the whole file it was written in, not the element it is nested in. Move it to the top level of the file, so where it sits reads like what it applies to.")

    assertOffenses(dedent`
      <div class="card">
        <style scoped>.a { color: red; }</style>
        <h1>Hi</h1>
      </div>
    `)
  })
})
