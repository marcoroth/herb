import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoEmptyAttributesRule } from "../../src/rules/html-no-empty-attributes.js"

describe("html-no-empty-attributes", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for attributes with meaningful values", () => {
    const html = '<div id="header" class="container" name="main"></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for empty id attribute", () => {
    const html = '<div id=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty class attribute", () => {
    const html = '<div class=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty name attribute", () => {
    const html = '<input name="">'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `name` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty for attribute", () => {
    const html = '<label for="">Label</label>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `for` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty src attribute", () => {
    const html = '<img src="" alt="Image">'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `src` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty href attribute", () => {
    const html = '<a href="">Link</a>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `href` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty title attribute", () => {
    const html = '<a href="https://example.com" title="">Link</a>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `title` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for empty data attribute", () => {
    const html = '<div data=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `data` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for data-* attributes with empty values", () => {
    const html = '<div data-value="" data-config=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)

    expect(lintResult.offenses[0].message).toBe('Attribute `data-value` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
    expect(lintResult.offenses[1].message).toBe('Attribute `data-config` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[1].severity).toBe("warning")
  })

  test("fails for aria-* attributes with empty values", () => {
    const html = '<button aria-label="" aria-describedby="">Button</button>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)

    expect(lintResult.offenses[0].message).toBe('Attribute `aria-label` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
    expect(lintResult.offenses[1].message).toBe('Attribute `aria-describedby` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[1].severity).toBe("warning")
  })

  test("fails for role attribute with empty value", () => {
    const html = '<div role=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)

    expect(lintResult.offenses[0].message).toBe('Attribute `role` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for multiple empty attributes", () => {
    const html = '<div id="" class="" data-test=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(3)

    expect(lintResult.offenses[0].message).toBe('Attribute `id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
    expect(lintResult.offenses[1].message).toBe('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[1].severity).toBe("warning")
    expect(lintResult.offenses[2].message).toBe('Attribute `data-test` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[2].severity).toBe("warning")
  })

  test("fails for whitespace-only values", () => {
    const html = '<div id="   " class=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)

    expect(lintResult.offenses[0].message).toBe('Attribute `id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
    expect(lintResult.offenses[1].message).toBe('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[1].severity).toBe("warning")
  })

  test("passes for attributes with ERB output", () => {
    const html = '<div id="<%= element_id %>" class="<%= css_classes %>"></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for mixed static and ERB content", () => {
    const html = '<div class="base <%= additional_classes %>"></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for dynamic data-* attribute name with empty value", () => {
    const html = '<div data-<%= key %>=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute `data-<%= key %>` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for dynamic data-* composite name with empty value", () => {
    const html = '<div data-<%= key %>-id=""></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute `data-<%= key %>-id` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for dynamic data-* attribute name with whitespace-only value", () => {
    const html = '<div data-<%= key %>="   "></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute `data-<%= key %>` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("fails for dynamic aria-* attribute name with empty value", () => {
    const html = '<button aria-<%= prop %>=""></button>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute `aria-<%= prop %>` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
    expect(lintResult.offenses[0].severity).toBe("warning")
  })

  test("passes for dynamic attribute name with ERB value", () => {
    const html = '<div data-<%= key %>="<%= value %>"></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for attribute with ERB that doesn't output anything", () => {
    const html = '<div class="<% value %>"></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute `class` must not be empty. Either provide a meaningful value or remove the attribute entirely.')
  })

  test("passes for attribute with static value and ERB that doesn't output anything", () => {
    const html = '<div class="something.<% value %>"></div>'

    const linter = new Linter(Herb, [HTMLNoEmptyAttributesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
