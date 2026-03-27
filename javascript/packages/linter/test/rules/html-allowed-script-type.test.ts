import { describe, test } from "vitest"
import { HTMLAllowedScriptTypeRule } from "../../src/rules/html-allowed-script-type.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAllowedScriptTypeRule)

describe("html-allowed-script-type", () => {
  test("passes when type attribute is blank", () => {
    expectNoOffenses('<script></script>')
  })

  test("fails when type attribute has no value", () => {
    expectError('Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.')

    assertOffenses('<script type></script>')
  })

  test("fails when type attribute has empty value", () => {
    expectError('Avoid using an empty `type` attribute on the `<script>` tag. Either set a valid type or remove the attribute entirely.')

    assertOffenses('<script type=""></script>')
  })

  test("passes when type is text/javascript", () => {
    expectNoOffenses('<script type="text/javascript"></script>')
  })

  test("passes when type is module", () => {
    expectNoOffenses('<script type="module"></script>')
  })

  test("passes when type is importmap", () => {
    expectNoOffenses('<script type="importmap"></script>')
  })

  test("passes when type is speculationrules", () => {
    expectNoOffenses('<script type="speculationrules"></script>')
  })

  test("passes for script tag with ERB in type attribute", () => {
    expectNoOffenses('<script type="<%= script_type %>"></script>')
  })

  test("fails when type is not allowed", () => {
    expectError('Avoid using `text/yavascript` as the `type` attribute for the `<script>` tag. Must be one of: `text/javascript`, `module`, `importmap`, `speculationrules` or blank.')

    assertOffenses('<script type="text/yavascript"></script>')
  })

  test("ignores non-script tags", () => {
    expectNoOffenses('<input type="text">')
  })
})
