import dedent from "dedent"
import { describe, test } from "vitest"

import { HerbScopedStyleSingleDeclarationRule } from "../../src/rules/herb-scoped-style-single-declaration.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbScopedStyleSingleDeclarationRule)

describe("herb-scoped-style-single-declaration", () => {
  test("passes with a single scoped block", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .a { color: red; }
      </style>

      <div>Hi</div>
    `)
  })

  test("passes with no scoped block", () => {
    expectNoOffenses("<div>Hi</div>")
  })

  test("passes with a plain style block alongside a scoped one", () => {
    expectNoOffenses(dedent`
      <style>.global { color: blue; }</style>
      <style scoped>.a { color: red; }</style>
      <div>Hi</div>
    `)
  })

  test("fails on a second scoped block", () => {
    expectWarning("This file already declares its scoped styles in the `<style scoped>` block on line 1. A file declares its scoped styles once, so merge these rules into that block.")

    assertOffenses(dedent`
      <style scoped>.a { color: red; }</style>
      <div>Hi</div>
      <style scoped>.b { color: blue; }</style>
    `)
  })

  test("counts a nested scoped block toward the total", () => {
    expectWarning("This file already declares its scoped styles in the `<style scoped>` block on line 1. A file declares its scoped styles once, so merge these rules into that block.")

    assertOffenses(dedent`
      <style scoped>.a { color: red; }</style>
      <div>
        <style scoped>.b { color: blue; }</style>
      </div>
    `)
  })
})
