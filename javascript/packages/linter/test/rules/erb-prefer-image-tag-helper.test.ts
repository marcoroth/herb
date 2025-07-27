import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import dedent from "dedent"
import { Linter } from "../../src/linter.js"
import { ERBPreferImageTagHelperRule } from "../../src/rules/erb-prefer-image-tag-helper.js"

describe("erb-prefer-image-tag-helper", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for regular img tags without ERB", () => {
    const html = '<img src="/logo.png" alt="Company logo">'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for image_tag helper usage", () => {
    const html = '<%= image_tag "logo.png", alt: "Company logo", class: "logo" %>'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for img with image_path helper", () => {
    const html = '<img src="<%= image_path("logo.png") %>" alt="Logo">'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("erb-prefer-image-tag-helper")
    expect(lintResult.offenses[0].message).toBe('Prefer `image_tag` helper over manual `<img>` with Rails URL helpers. Use `<%= image_tag "filename.png", alt: "description" %>` instead.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for img with asset_path helper", () => {
    const html = '<img src="<%= asset_path("banner.jpg") %>" alt="Banner">'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("erb-prefer-image-tag-helper")
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("handles self-closing img tags with image_path", () => {
    const html = '<img src="<%= image_path("logo.png") %>" alt="Logo" />'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
  })

  test("ignores non-img tags with image_path", () => {
    const html = '<div data-background="<%= image_path("bg.jpg") %>">Content</div>'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for img with Rails URL helpers", () => {
    const html = '<img src="<%= Rails.application.routes.url_helpers.root_url %>/icon.png" alt="Logo">'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("erb-prefer-image-tag-helper")
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for img with root_url helper", () => {
    const html = '<img src="<%= root_url %>/banner.jpg" alt="Banner">'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
  })

  test("fails for img with custom path helpers", () => {
    const html = '<img src="<%= admin_path %>/icon.png" alt="Admin icon">'
    const result = Herb.parse(html)
    const linter = new Linter([ERBPreferImageTagHelperRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
  })
})
