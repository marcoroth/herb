import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { ERBNoExtraNewLineRule } from "../../src/rules/erb-no-extra-newline.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoExtraNewLineRule)

describe("erb-no-extra-newline", () => {
  describe("text content", () => {
    test("when no new line is present", () => {
      expectNoOffenses(dedent`
        line 1
      `)
    })

    test("when no blank lines are present", () => {
      expectNoOffenses(dedent`
        line 1
        line 2
        line 3
      `)
    })

    test("when a single blank line is present", () => {
      expectNoOffenses(dedent`
        line 1

        line 3
      `)
    })

    test("when two blank lines follow each other", () => {
      expectNoOffenses(dedent`
        line 1


        line 3
      `)
    })

    test("when more than two newlines follow each other", () => {
      expectError("Extra blank line detected.")

      assertOffenses(dedent`
        line 1



        line 3
      `)
    })
  })

  describe("HTML elements", () => {
    test("when no new line is present", () => {
      expectNoOffenses(dedent`
        <div>Hello</div>
      `)
    })

    test("when two blank lines follow each other", () => {
      expectNoOffenses(dedent`
        <div>Hello</div>


        <div>Hello</div>
      `)
    })

    test("when more than two newlines follow each other", () => {
      expectError("Extra blank line detected.")

      assertOffenses(dedent`
        <div>Hello</div>



        <div>Hello</div>
      `)
    })
  })
})
