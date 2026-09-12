import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HerbStateDirectiveSyntaxRule } from "../../src/rules/herb-state-directive-syntax.js"

describe("herb-state-directive-syntax autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const autofix = (input: string) => {
    const linter = new Linter(Herb, [HerbStateDirectiveSyntaxRule])

    return linter.autofix(input)
  }

  const expectFix = (input: string, expected: string, count: number = 1) => {
    const result = autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(count)
    expect(result.unfixed).toHaveLength(0)
  }

  const expectNoFix = (input: string) => {
    const result = autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  }

  test("rewrites a leading trim marker", () => {
    expectFix(`<%#- herb:state (open: false) -%>`, `<%# herb:state (open: false) %>`)
  })

  test("rewrites a trailing trim marker", () => {
    expectFix(`<%# herb:state (open: false) -%>`, `<%# herb:state (open: false) %>`)
  })

  test("adds the missing space after the comment opening", () => {
    expectFix(`<%#herb:state (open: false) %>`, `<%# herb:state (open: false) %>`)
  })

  test("collapses extra whitespace before the signature", () => {
    expectFix(`<%# herb:state  (open: false) %>`, `<%# herb:state (open: false) %>`)
  })

  test("adds the missing space before the comment closing", () => {
    expectFix(`<%# herb:state (open: false)%>`, `<%# herb:state (open: false) %>`)
  })

  test("rewrites a tab into a space", () => {
    expectFix(`<%#\therb:state (open: false) %>`, `<%# herb:state (open: false) %>`)
  })

  test("joins a signature spread across several lines", () => {
    expectFix(`<%# herb:state (\n  open: false,\n  count: 0\n) %>`, `<%# herb:state (open: false, count: 0) %>`)
  })

  test("keeps whitespace inside a string default", () => {
    expectFix(`<%# herb:state  (title: "a  b") %>`, `<%# herb:state (title: "a  b") %>`)
  })

  test("leaves the surrounding markup alone", () => {
    expectFix(
      dedent`
        <div>
          <%#- herb:state (open: false) -%>
          <p>text</p>
        </div>
      `,
      dedent`
        <div>
          <%# herb:state (open: false) %>
          <p>text</p>
        </div>
      `,
    )
  })

  test("fixes every directive in the document", () => {
    expectFix(
      `<%#- herb:state (a: 1) -%>\n<% items.each do |item| %>\n  <%#herb:state (b: 2) %>\n<% end %>`,
      `<%# herb:state (a: 1) %>\n<% items.each do |item| %>\n  <%# herb:state (b: 2) %>\n<% end %>`,
      2,
    )
  })

  test("does not touch a canonical directive", () => {
    expectNoFix(`<%# herb:state (open: false) %>`)
  })

  test("does not touch a directive without parentheses", () => {
    expectNoFix(`<%# herb:state open: false %>`)
  })

  test("does not touch other directives", () => {
    expectNoFix(`<%# herb:slots client %>`)
  })
})
