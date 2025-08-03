import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLAriaLevelMustBeValidRule } from "../../src/rules/html-aria-level-must-be-valid.js"

describe("HTMLAriaLevelMustBeValidRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("allows valid aria-level values 1-6", () => {
    const html = dedent`
      <div role="heading" aria-level="1">Main</div>
      <div role="heading" aria-level="2">Section</div>
      <div role="heading" aria-level="3">Subsection</div>
      <div role="heading" aria-level="4">Sub-subsection</div>
      <div role="heading" aria-level="5">Deep heading</div>
      <div role="heading" aria-level="6">Footnote</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("allows elements without aria-level attribute", () => {
    const html = dedent`
      <div role="heading">No aria-level</div>
      <h1>Regular heading</h1>
      <div>Regular div</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("flags negative aria-level values", () => {
    const html = dedent`
      <div role="heading" aria-level="-1">Negative</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("html-aria-level-must-be-valid")
    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `-1`.',
    )
  })

  test("flags zero aria-level value", () => {
    const html = dedent`
      <div role="heading" aria-level="0">Main</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("html-aria-level-must-be-valid")
    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `0`.',
    )
  })

  test("flags aria-level values greater than 6", () => {
    const html = dedent`
      <div role="heading" aria-level="7">Too deep</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("html-aria-level-must-be-valid")
    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `7`.',
    )
  })

  test("flags non-numeric aria-level values", () => {
    const html = dedent`
      <div role="heading" aria-level="foo">Invalid</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("html-aria-level-must-be-valid")
    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `foo`.',
    )
  })

  test("flags multiple invalid aria-level values", () => {
    const html = dedent`
      <div role="heading" aria-level="-1">Negative</div>
      <div role="heading" aria-level="0">Zero</div>
      <div role="heading" aria-level="7">Too deep</div>
      <div role="heading" aria-level="foo">Invalid</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(4)

    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `-1`.',
    )
    expect(lintResult.offenses[1].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `0`.',
    )
    expect(lintResult.offenses[2].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `7`.',
    )
    expect(lintResult.offenses[3].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `foo`.',
    )
  })

  test("handles floating point numbers", () => {
    const html = dedent`
      <div role="heading" aria-level="1.5">Float</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got `1.5`.',
    )
  })

  test("flags whitespace in aria-level values", () => {
    const html = dedent`
      <div role="heading" aria-level=" 2 ">Whitespace</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The `aria-level` attribute must be an integer between 1 and 6, got ` 2 `.',
    )
  })

  test("allows ERB expressions in aria-level values", () => {
    const html = dedent`
      <div aria-level="<%= @level %>">Dynamic level</div>
    `
    const linter = new Linter(Herb, [HTMLAriaLevelMustBeValidRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
