import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoConsecutiveCommentsRule } from "../../src/rules/html-no-consecutive-comments.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoConsecutiveCommentsRule)

describe("html-no-consecutive-comments", () => {
  test("passes for a single HTML comment", () => {
    expectNoOffenses(`<!-- comment -->\n`)
  })

  test("passes for two consecutive HTML comments", () => {
    expectNoOffenses(dedent`
      <!-- comment 1 -->
      <!-- comment 2 -->
    `)
  })

  test("fails for three consecutive HTML comments", () => {
    expectWarning("3 consecutive comments can be condensed into fewer comments.")
    assertOffenses(dedent`
      <!-- comment 1 -->
      <!-- comment 2 -->
      <!-- comment 3 -->
    `)
  })

  test("fails for four consecutive HTML comments", () => {
    expectWarning("4 consecutive comments can be condensed into fewer comments.")
    assertOffenses(dedent`
      <!-- comment 1 -->
      <!-- comment 2 -->
      <!-- comment 3 -->
      <!-- comment 4 -->
    `)
  })

  test("passes for comments separated by content", () => {
    expectNoOffenses(dedent`
      <!-- comment 1 -->
      <div>content</div>
      <!-- comment 2 -->
      <p>more content</p>
      <!-- comment 3 -->
    `)
  })

  test("passes for a single ERB comment", () => {
    expectNoOffenses(`<%# comment %>\n`)
  })

  test("passes for two consecutive ERB comments", () => {
    expectNoOffenses(dedent`
      <%# comment 1 %>
      <%# comment 2 %>
    `)
  })

  test("fails for three consecutive ERB comments", () => {
    expectWarning("3 consecutive comments can be condensed into fewer comments.")
    assertOffenses(dedent`
      <%# comment 1 %>
      <%# comment 2 %>
      <%# comment 3 %>
    `)
  })

  test("fails for mixed HTML and ERB comments", () => {
    expectWarning("3 consecutive comments can be condensed into fewer comments.")
    assertOffenses(dedent`
      <!-- HTML comment -->
      <%# ERB comment %>
      <!-- another HTML comment -->
    `)
  })

  test("passes when herb:disable breaks the chain", () => {
    expectNoOffenses(dedent`
      <!-- comment 1 -->
      <%# herb:disable html-tag-name-lowercase %>
      <!-- comment 2 -->
      <!-- comment 3 -->
    `)
  })

  test("passes when herb:enable breaks the chain", () => {
    expectNoOffenses(dedent`
      <!-- comment 1 -->
      <%# herb:enable html-tag-name-lowercase %>
      <!-- comment 2 -->
      <!-- comment 3 -->
    `)
  })

  test("fails for consecutive comments inside an element", () => {
    expectWarning("3 consecutive comments can be condensed into fewer comments.")
    assertOffenses(dedent`
      <div>
        <!-- comment 1 -->
        <!-- comment 2 -->
        <!-- comment 3 -->
      </div>
    `)
  })

  test("passes for two comments inside an element", () => {
    expectNoOffenses(dedent`
      <div>
        <!-- comment 1 -->
        <!-- comment 2 -->
      </div>
    `)
  })

  test("reports separate offenses for separate groups", () => {
    expectWarning("3 consecutive comments can be condensed into fewer comments.", [1])
    expectWarning("3 consecutive comments can be condensed into fewer comments.", [7])
    assertOffenses(dedent`
      <!-- comment 1 -->
      <!-- comment 2 -->
      <!-- comment 3 -->
      <div>content</div>
      <!-- comment 4 -->
      <p>separator</p>
      <!-- comment 5 -->
      <!-- comment 6 -->
      <!-- comment 7 -->
    `)
  })

  test("passes for comments with content between them inside element", () => {
    expectNoOffenses(dedent`
      <div>
        <!-- comment 1 -->
        <span>content</span>
        <!-- comment 2 -->
        <span>more</span>
        <!-- comment 3 -->
      </div>
    `)
  })

  test("does not count herb:linter ignore as a comment", () => {
    expectNoOffenses(dedent`
      <!-- comment 1 -->
      <%# herb:linter ignore %>
      <!-- comment 2 -->
      <!-- comment 3 -->
    `)
  })
})
