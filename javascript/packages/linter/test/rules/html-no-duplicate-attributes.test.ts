import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoDuplicateAttributesRule } from "../../src/rules/html-no-duplicate-attributes.js"

describe("html-no-duplicate-attributes", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for unique attributes", () => {
    const html = '<input type="text" name="username" id="user-id">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("fails for duplicate attributes", () => {
    const html = '<input type="text" type="password" name="username">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(1)

    expect(lintResult.messages[0].rule).toBe("html-no-duplicate-attributes")
    expect(lintResult.messages[0].message).toContain('Duplicate attribute "type"')
    expect(lintResult.messages[0].severity).toBe("error")
  })

  test("fails for multiple duplicate attributes", () => {
    const html = '<button type="submit" type="button" class="btn" class="primary">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2) // One for type, one for class
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(2)
  })

  test("handles case-insensitive duplicates", () => {
    const html = '<div Class="container" class="active">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toContain('Duplicate attribute "class"')
  })

  test("passes for different attributes", () => {
    const html = '<div class="container" id="main" data-value="test">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles self-closing tags", () => {
    const html = '<img src="/logo.png" src="/backup.png" alt="Logo">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toContain('Duplicate attribute "src"')
  })

  test("handles ERB templates with attributes", () => {
    const html = '<div class="<%= classes %>" data-id="<%= item.id %>">'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores closing tags", () => {
    const html = '<div class="test"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLNoDuplicateAttributesRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
