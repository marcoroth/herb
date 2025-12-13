import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"

describe("html-tag-name-lowercase autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("converts single uppercase tag to lowercase", () => {
    const input = `<DIV>Hello</DIV>`
    const expected = `<div>Hello</div>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts mixed case tags", () => {
    const input = `<Div><Span>Text</Span></Div>`
    const expected = `<div><span>Text</span></div>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(4)
  })

  test("handles self-closing tags", () => {
    const input = `<BR />`
    const expected = `<br />`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles nested uppercase tags", () => {
    const input = `<DIV><UL><LI>Item 1</LI><LI>Item 2</LI></UL></DIV>`
    const expected = `<div><ul><li>Item 1</li><li>Item 2</li></ul></div>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(8)
  })

  test("preserves attributes when fixing tag names", () => {
    const input = `<DIV class="container" id="main">Content</DIV>`
    const expected = `<div class="container" id="main">Content</div>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("handles multiple root elements", () => {
    const input = dedent`
      <DIV>First</DIV>
      <SPAN>Second</SPAN>
      <P>Third</P>
    `

    const expected = dedent`
      <div>First</div>
      <span>Second</span>
      <p>Third</p>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(6)
  })

  test("handles form elements", () => {
    const input = `<FORM><INPUT type="text"><BUTTON>Submit</BUTTON></FORM>`
    const expected = `<form><input type="text"><button>Submit</button></form>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(5)
  })

  test("does not affect already lowercase SVG tags", () => {
    const input = `<svg><linearGradient></linearGradient></svg>`
    const expected = `<svg><linearGradient></linearGradient></svg>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes one offense at a time", () => {
    const input = `<DIV>Hello</DIV>`
    const expected = `<div>Hello</div>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(input)
    const result = linter.autofix(input, undefined, [lintResult.offenses[0]])

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes multiple selected offenses", () => {
    const input = `<FORM><INPUT type="text"><BUTTON>Submit</BUTTON></FORM>`
    const expected = `<form><input type="text"><button>Submit</button></form>`

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(input)
    const result = linter.autofix(input, undefined, [lintResult.offenses[1], lintResult.offenses[3], lintResult.offenses[4]])

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
  })
})
