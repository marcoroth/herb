import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HerbCounterCommentValidRuleNameRule } from "../../src/rules/herb-counter-comment-valid-rule-name.js"
import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest([
  HerbCounterCommentValidRuleNameRule,
  HTMLTagNameLowercaseRule,
])

describe("HerbCounterCommentValidRuleNameRule", () => {
  test("accepts a known rule name", () => {
    expectNoOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase 0 %>
    `)
  })

  test("warns on an unknown rule", () => {
    expectWarning("Unknown rule `no-such-rule` in `herb:counter` comment. Did you mean `html-tag-name-lowercase`?")

    assertOffenses(dedent`
      <%# herb:counter no-such-rule 1 %>
    `)
  })

  test("offers a did-you-mean suggestion when close", () => {
    expectWarning("Unknown rule `html-tag-name-lowercas` in `herb:counter` comment. Did you mean `html-tag-name-lowercase`?")

    assertOffenses(dedent`
      <%# herb:counter html-tag-name-lowercas 1 %>
    `)
  })
})
