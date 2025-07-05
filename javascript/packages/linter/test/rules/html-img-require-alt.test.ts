import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLImgRequireAltRule } from "../../src/rules/html-img-require-alt.js"

describe("html-img-require-alt", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for img with alt attribute", () => {
    const html = '<img src="/logo.png" alt="Company logo">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for img with empty alt attribute", () => {
    const html = '<img src="/divider.png" alt="">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for img without alt attribute", () => {
    const html = '<img src="/logo.png">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-img-require-alt")
    expect(lintResult.offenses[0].message).toBe('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails for multiple img tags without alt", () => {
    const html = '<img src="/logo.png"><img src="/banner.jpg">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
  })

  test("handles mixed case img tags", () => {
    const html = '<IMG src="/logo.png">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
  })

  test("passes for img with ERB alt attribute", () => {
    const html = '<img src="/avatar.jpg" alt="<%= user.name %>\'s profile picture">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores non-img tags", () => {
    const html = '<div src="/something.png"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles self-closing img tags", () => {
    const html = '<img src="/logo.png" />'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Missing required `alt` attribute on `<img>` tag. Add `alt=""` for decorative images or `alt="description"` for informative images.')
  })

  test("passes for case-insensitive alt attribute", () => {
    const html = '<img src="/logo.png" ALT="Logo">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLImgRequireAltRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
