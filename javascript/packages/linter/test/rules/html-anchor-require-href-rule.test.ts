import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAnchorRequireHrefRule } from "../../src/rules/html-anchor-require-href.js"

describe("html-anchor-require-href", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for a with href attribute", () => {
    const html = '<a href="http://example.com">My link</a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAnchorRequireHrefRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("fails for a without href attribute", () => {
    const html = "<a>My link</a>"
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAnchorRequireHrefRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(1)

    expect(lintResult.messages[0].rule).toBe("html-anchor-require-href")
    expect(lintResult.messages[0].message).toBe(
      "Missing required `href` attribute on `<a>` tag.",
    )
    expect(lintResult.messages[0].severity).toBe("error")
  })

  test("fails for multiple a tags without href", () => {
    const html = "<a>My link</a><a>My other link</a>"
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAnchorRequireHrefRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(2)
  })

  test("passes for img with ERB alt attribute", () => {
    const html = '<a href="<%= user.home_page_url %>">My Link</a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAnchorRequireHrefRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores non-a tags", () => {
    const html = "<div>My div</div>"
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAnchorRequireHrefRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case a tags", () => {
    const html = "<A>My link</A>"
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAnchorRequireHrefRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe(
      "Missing required `href` attribute on `<a>` tag.",
    )
  })
})
