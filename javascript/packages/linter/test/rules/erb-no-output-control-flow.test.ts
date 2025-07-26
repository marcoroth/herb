import { describe, it, beforeAll, expect } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import dedent from "dedent";

import { Linter } from "../../src/linter";
import { ERBNoOutputControlFlowRule } from "../../src/rules/erb-no-output-control-flow";

describe("erb-no-output-control-flow", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("should allow if statements without output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <% elsif false %>
        <div>Text2</div>
      <% else %>
        <div>Text3</div>
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)
    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should not allow if statments with output tags", () => {
    const html = dedent`
      <%= if true %>
        <div>Text1</div>
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should not allow unless statements with output tags", () => {
    const html = dedent`
      <%= unless false %>
        <div>Text1</div>
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should not allow end statements with output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <%= end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should not allow nested control flow blocks with output tags", () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
        <%= if true %>
          <div>Nested Text</div>
        <% end %>
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it('should show multiple errors for multiple output tags', () => {
    const html = dedent`
      <% if true %>
        <div>Text1</div>
      <%= elsif false %>
        <div>Text2</div>
      <%= else %>
        <div>Text3</div>
      <%= end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(3)
  })

  it("should show an error for outputting control flow blocks with nested control flow blocks", () => {
   const html = dedent`
      <% unless something? %>
        <%= if true %>
          thing
        <% end %>
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should not report for link to with an if condition", () => {
   const html = dedent`
      <%= link_to(some_url, class: ("some-class" if some_condition)) do %>
        Click
      <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should not report on form_builder.fieldset with block", () => {
   const html = dedent`
     <%= form_builder.fieldset(
       "foo",
       :foo,
       required: true,
       hint:
         if some_condition?
           "foo"
         else
           "bar"
         end
     ) do %>
         <%# ... %>
     <% end %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should not report on yield with if in the same ERB tag", () => {
   const html = dedent`
      <%= yield(:header) if content_for?(:header) %>
    `
    const result = Herb.parse(html)
    const linter = new Linter([ERBNoOutputControlFlowRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
