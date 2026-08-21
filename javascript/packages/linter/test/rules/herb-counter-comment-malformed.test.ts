import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HerbCounterCommentMalformedRule } from "../../src/rules/herb-counter-comment-malformed.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbCounterCommentMalformedRule)

describe("HerbCounterCommentMalformedRule", () => {
  test("accepts a well-formed comment", () => {
    expectNoOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase 3 %>
    `)
  })

  test("rejects a comment missing the count", () => {
    expectError("`herb:counter` comment is missing a count. Expected `herb:counter <RuleName> <count>` with a non-negative integer count.")

    assertOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase %>
    `)
  })

  test("rejects a comment with a non-integer count", () => {
    expectError("`herb:counter` comment has an invalid count `three`. The count must be a non-negative integer.")

    assertOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase three %>
    `)
  })

  test("rejects a comment with extra tokens", () => {
    expectError("`herb:counter` comment has extra content after the count. Expected exactly `herb:counter <RuleName> <count>`.")

    assertOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase 3 extra %>
    `)
  })

  test("rejects a comment with a negative count", () => {
    expectError("`herb:counter` comment has an invalid count `-1`. The count must be a non-negative integer.")

    assertOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase -1 %>
    `)
  })
})
