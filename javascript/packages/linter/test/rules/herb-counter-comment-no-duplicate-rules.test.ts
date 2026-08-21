import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HerbCounterCommentNoDuplicateRulesRule } from "../../src/rules/herb-counter-comment-no-duplicate-rules.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HerbCounterCommentNoDuplicateRulesRule)

describe("HerbCounterCommentNoDuplicateRulesRule", () => {
  test("accepts a single counter comment per rule", () => {
    expectNoOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase 3 %>
      <%# herb:counter html-attribute-double-quotes 2 %>
    `)
  })

  test("warns on the second occurrence when the same rule appears twice", () => {
    expectWarning("Duplicate `herb:counter` comment for rule `html-tag-name-lowercase`. Only one `herb:counter` comment is allowed per rule per file.")

    assertOffenses(dedent`
      <%# herb:counter html-tag-name-lowercase 3 %>
      <%# herb:counter html-tag-name-lowercase 5 %>
    `)
  })
})
