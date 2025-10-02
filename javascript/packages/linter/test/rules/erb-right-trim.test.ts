import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBRightTrimRule } from "../../src/rules/erb-right-trim.js"

describe("ERBRightTrimRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("when the erb tag close with %>", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the erb tag close with -%>", () => {
    const html = dedent`
      <h1>
        <%= title -%>
      </h1>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the erb tag close with =%>", () => {
    const html = dedent`
      <h1>
        <%= title =%>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-right-trim")
    expect(lintResult.offenses[0].message).toBe("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines")
  })

  test("when an if block uses =%>", () => {
    const html = dedent`
      <% if condition =%>
        <p>Content</p>
      <% end %>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-right-trim")
    expect(lintResult.offenses[0].message).toBe("Right-trimming with `=%>` has no effect on non-output ERB tags. Use `%>` instead")
  })

  test("when an if-else block uses =%>", () => {
    const html = dedent`
      <% if condition =%>
        <p>True branch</p>
      <% else =%>
        <p>False branch</p>
      <% end %>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
    expect(lintResult.offenses[0].code).toBe("erb-right-trim")

    expect(lintResult.offenses[0].message).toBe("Right-trimming with `=%>` has no effect on non-output ERB tags. Use `%>` instead")
    expect(lintResult.offenses[1].message).toBe("Right-trimming with `=%>` has no effect on non-output ERB tags. Use `%>` instead")
  })

  test("when each block uses =%>", () => {
    const html = dedent`
      <% items.each do |item| =%>
        <li><%= item %></li>
      <% end %>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-right-trim")
    expect(lintResult.offenses[0].message).toBe("Right-trimming with `=%>` has no effect on non-output ERB tags. Use `%>` instead")
  })

  test("when non-output tag uses -%>", () => {
    const html = dedent`
      <% if condition -%>
        <p>Content</p>
      <% elsif other_condition -%>
        <p>Content</p>
      <% elsif yet_another_condition -%>
        <p>Content</p>
      <% else -%>
        <p>Content</p>
      <% end -%>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(5)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(5)

    expect(lintResult.offenses[0].code).toBe("erb-right-trim")
    expect(lintResult.offenses[0].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
    expect(lintResult.offenses[1].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
    expect(lintResult.offenses[2].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
    expect(lintResult.offenses[3].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
    expect(lintResult.offenses[4].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
  })

  test("when multiple non-output tags use trimming", () => {
    const html = dedent`
      <% items.each do |item| -%>
        <li><%= item %></li>
      <% end -%>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
    expect(lintResult.offenses[1].message).toBe("Right-trimming with `-%>` has no effect on non-output ERB tags. Use `%>` instead")
  })
})
