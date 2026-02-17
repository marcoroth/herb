import { describe, test } from "vitest"
import { HTMLAllowedScriptTypeRule } from "../../src/rules/html-allowed-script-type.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAllowedScriptTypeRule)

describe("html-allowed-script-type", () => {
  test("fails when type attribute is blank", () => {
    expectError('`type` attribute required for `<script>` tag.')

    assertOffenses('<script></script>')
  })

  test("fails when type attribute has no value", () => {
    expectError('`type` attribute required for `<script>` tag.')

    assertOffenses('<script type></script>')
  })

  test("passes when type is allowed", () => {
    expectNoOffenses('<script type="text/javascript"></script>')
  })

  test("passes for script tag with ERB in type attribute", () => {
    expectNoOffenses('<script type="<%= script_type %>"></script>')
  })

  test("fails when type is not allowed", () => {
    expectError(
      'Avoid using "text/yavascript" as type for `<script>` tag. Must be one of: text/javascript.'
    )

    assertOffenses('<script type="text/yavascript"></script>')
  })

  test("ignores non-script tags", () => {
    expectNoOffenses('<input type="text">')
  })
})
