import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLTagNameLowercaseRule } from "../src/rules/html-tag-name-lowercase.js"
import { createLinterTest } from "./helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLTagNameLowercaseRule)

describe("herb:linter ignore directive", () => {
  test("should ignore all linting when directive is at top of file", () => {
    expectNoOffenses(dedent`
      <%# herb:linter ignore %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `)
  })

  test("should ignore linting when directive is in middle of file", () => {
    expectNoOffenses(dedent`
      <div>
        <%# herb:linter ignore %>
        <SPAN>content</SPAN>
      </div>
    `)
  })

  test("should work with empty lines before directive", () => {
    expectNoOffenses(`

      <%# herb:linter ignore %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `)
  })

  test("should not match herb:linter ignore with extra text", () => {
    expectError('Opening tag name `<DIV>` should be lowercase. Use `<div>` instead.')
    expectError('Opening tag name `<SPAN>` should be lowercase. Use `<span>` instead.')
    expectError('Closing tag name `</SPAN>` should be lowercase. Use `</span>` instead.')
    expectError('Closing tag name `</DIV>` should be lowercase. Use `</div>` instead.')

    assertOffenses(dedent`
      <%# herb:linter ignore some-rule %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `)
  })

  test("should not match herb:disable all", () => {
    expectError('Opening tag name `<DIV>` should be lowercase. Use `<div>` instead.')
    expectError('Opening tag name `<SPAN>` should be lowercase. Use `<span>` instead.')
    expectError('Closing tag name `</SPAN>` should be lowercase. Use `</span>` instead.')
    expectError('Closing tag name `</DIV>` should be lowercase. Use `</div>` instead.')

    assertOffenses(dedent`
      <%# herb:disable all %>
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
    `)
  })

  test("directive must be exact match", () => {
    expectError('Opening tag name `<DIV>` should be lowercase. Use `<div>` instead.')
    expectError('Closing tag name `</DIV>` should be lowercase. Use `</div>` instead.')

    assertOffenses(dedent`
      <%# herb:linter  ignore %>
      <DIV>content</DIV>
    `)
  })

  test("should ignore linting when directive is at end of file", () => {
    expectNoOffenses(dedent`
      <DIV>
        <SPAN>content</SPAN>
      </DIV>
      <%# herb:linter ignore %>
    `)
  })

  test("should ignore linting when directive is nested deep in document", () => {
    expectNoOffenses(dedent`
      <DIV>
        <SECTION>
          <ARTICLE>
            <%# herb:linter ignore %>
            <SPAN>content</SPAN>
          </ARTICLE>
        </SECTION>
      </DIV>
    `)
  })
})
