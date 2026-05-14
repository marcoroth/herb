import dedent from "dedent"
import { describe, test } from "vitest"

import { createLinterTest } from "../helpers/linter-test-helper.js"
import { A11yNoAriaLabelMisuseRule } from "../../src/rules/a11y-no-aria-label-misuse.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAriaLabelMisuseRule)

describe("a11y-no-aria-label-misuse", () => {
  test("passes for button with aria-label", () => {
    expectNoOffenses(`<button aria-label="Close">X</button>`)
  })

  test("passes for anchor with aria-labelledby", () => {
    expectNoOffenses(`<a href="/details" aria-labelledby="details-heading">Open</a>`)
  })

  test("passes for div with permitted role", () => {
    expectNoOffenses(`<div role="dialog" aria-labelledby="dialog-heading"></div>`)
  })

  test("passes for span with permitted role", () => {
    expectNoOffenses(`<span role="img" aria-label="Warning"></span>`)
  })

  test("passes for div with dynamic role", () => {
    expectNoOffenses(`<div role="<%= dialog_role %>" aria-label="Dialog"></div>`)
  })

  test("passes when target attributes are absent", () => {
    expectNoOffenses(`<span>Hello</span>`)
  })

  test("fails for span without role", () => {
    expectWarning("The `aria-label` attribute on `<span>` requires a permitted ARIA `role`.")
    assertOffenses(`<span aria-label="Tooltip">I am some text.</span>`)
  })

  test("fails for div without role", () => {
    expectWarning("The `aria-labelledby` attribute on `<div>` requires a permitted ARIA `role`.")
    assertOffenses(`<div aria-labelledby="heading1">Goodbye</div>`)
  })

  test("fails for hard-banned heading elements", () => {
    expectWarning("The `aria-label` attribute must not be used on the `<h1>` element.")
    assertOffenses(`<h1 aria-label="This will override the page title completely">Page title</h1>`)
  })

  test("fails for paragraph elements", () => {
    expectWarning("The `aria-labelledby` attribute must not be used on the `<p>` element.")
    assertOffenses(`<p aria-labelledby="description">Paragraph</p>`)
  })

  test("fails for code-style inline elements", () => {
    expectWarning("The `aria-label` attribute must not be used on the `<i>` element.")
    assertOffenses(`<i aria-label="Close"></i>`)
  })

  test("fails for prohibited generic role", () => {
    expectWarning("The `aria-label` attribute on `<div>` is not allowed with ARIA role `generic` because that role cannot be named.")
    assertOffenses(`<div role="generic" aria-label="Dialog"></div>`)
  })

  test("fails for prohibited presentation role", () => {
    expectWarning("The `aria-labelledby` attribute on `<span>` is not allowed with ARIA role `presentation` because that role cannot be named.")
    assertOffenses(`<span role="presentation" aria-labelledby="label-id"></span>`)
  })

  test("reports one offense per offending attribute", () => {
    expectWarning("The `aria-label` attribute on `<span>` requires a permitted ARIA `role`.")
    expectWarning("The `aria-labelledby` attribute on `<span>` requires a permitted ARIA `role`.")

    assertOffenses(`<span aria-label="Tooltip" aria-labelledby="tooltip-label"></span>`)
  })

  test("still fails on hard-banned tags when role is dynamic", () => {
    expectWarning("The `aria-label` attribute must not be used on the `<p>` element.")

    assertOffenses(dedent`
      <p role="<%= role_name %>" aria-label="Description">
        Text
      </p>
    `)
  })
})
