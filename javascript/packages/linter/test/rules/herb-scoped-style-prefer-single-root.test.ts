import dedent from "dedent"
import { describe, test } from "vitest"

import { HerbScopedStylePreferSingleRootRule } from "../../src/rules/herb-scoped-style-prefer-single-root.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbScopedStylePreferSingleRootRule)

describe("herb-scoped-style-prefer-single-root", () => {
  test("passes with a single root under a scoped block" , () => {
    expectNoOffenses(dedent`
      <style scoped>
        .title { color: red; }
      </style>

      <div class="card">
        <h1 class="title">Hi</h1>
      </div>
    `)
  })

  test("fails with more than one root under a scoped block", () => {
    expectWarning("A `<style scoped>` block reads best with a single root element. Wrap the 3 top-level elements in one element, so the scoped styles apply within a single root.")

    assertOffenses(dedent`
      <style scoped>
        .a { color: red; }
      </style>

      <header>One</header>
      <main>Two</main>
      <footer>Three</footer>
    `)
  })

  test("does not count the scoped block itself as a root", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .a { color: red; }
      </style>

      <div>Only root</div>
    `)
  })

  test("does not count a script element as a root", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .a { color: red; }
      </style>

      <div>Only root</div>
      <script>console.log(1)</script>
    `)
  })

  test("stays quiet when the file has no scoped block", () => {
    expectNoOffenses(dedent`
      <header>One</header>
      <main>Two</main>
      <footer>Three</footer>
    `)
  })

  test("stays quiet for a plain style block with many roots", () => {
    expectNoOffenses(dedent`
      <style>
        .a { color: red; }
      </style>

      <header>One</header>
      <main>Two</main>
    `)
  })

  test("reports once, at the scoped block", () => {
    expectWarning("A `<style scoped>` block reads best with a single root element. Wrap the 2 top-level elements in one element, so the scoped styles apply within a single root.")

    assertOffenses(dedent`
      <style scoped>
        .a { color: red; }
      </style>

      <header>One</header>
      <main>Two</main>
    `)
  })
})
