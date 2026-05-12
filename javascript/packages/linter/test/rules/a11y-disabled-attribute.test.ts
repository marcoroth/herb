import { describe, test } from "vitest"
import { A11yDisabledAttributeRule } from "../../src/rules/a11y-disabled-attribute.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yDisabledAttributeRule)

const MESSAGE = "The `disabled` attribute is only valid on button, fieldset, input, optgroup, option, select, textarea, task-lists."

describe("a11y-disabled-attribute", () => {
  describe("valid elements with disabled", () => {
    test("passes for button with disabled", () => {
      expectNoOffenses(`<button disabled>Click me</button>`)
    })

    test("passes for input with disabled", () => {
      expectNoOffenses(`<input type="text" disabled>`)
    })

    test("passes for textarea with disabled", () => {
      expectNoOffenses(`<textarea disabled></textarea>`)
    })

    test("passes for select with disabled", () => {
      expectNoOffenses(`<select disabled><option>A</option></select>`)
    })

    test("passes for option with disabled", () => {
      expectNoOffenses(`<option disabled>A</option>`)
    })

    test("passes for fieldset with disabled", () => {
      expectNoOffenses(`<fieldset disabled><input type="text"></fieldset>`)
    })

    test("passes for optgroup with disabled", () => {
      expectNoOffenses(`<optgroup disabled label="Group"><option>A</option></optgroup>`)
    })
  })

  describe("elements without disabled attribute", () => {
    test("passes for div without disabled", () => {
      expectNoOffenses(`<div>Content</div>`)
    })

    test("passes for anchor without disabled", () => {
      expectNoOffenses(`<a href="https://github.com/">Go to GitHub</a>`)
    })

    test("passes for span without disabled", () => {
      expectNoOffenses(`<span>Text</span>`)
    })
  })

  describe("invalid elements with disabled", () => {
    test("fails for anchor with disabled", () => {
      expectWarning(MESSAGE)
      assertOffenses(`<a href="https://github.com/" disabled>Go to GitHub</a>`)
    })

    test("fails for div with disabled", () => {
      expectWarning(MESSAGE)
      assertOffenses(`<div disabled>Content</div>`)
    })

    test("fails for span with disabled", () => {
      expectWarning(MESSAGE)
      assertOffenses(`<span disabled>Text</span>`)
    })

    test("fails for paragraph with disabled", () => {
      expectWarning(MESSAGE)
      assertOffenses(`<p disabled>Text</p>`)
    })

    test("fails for section with disabled", () => {
      expectWarning(MESSAGE)
      assertOffenses(`<section disabled>Content</section>`)
    })

    test("fails for multiple invalid elements", () => {
      expectWarning(MESSAGE)
      expectWarning(MESSAGE)
      assertOffenses(`
        <div disabled>Content</div>
        <a href="#" disabled>Link</a>
      `)
    })
  })
})
