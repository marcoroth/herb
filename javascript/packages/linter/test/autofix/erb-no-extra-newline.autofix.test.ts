import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoExtraNewLineRule } from "../../src/rules/erb-no-extra-newline.js"

describe("erb-no-extra-newline autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes extra blank lines in text content", () => {
    const input = dedent`
      line 1




      line 2
    `
    const expected = dedent`
      line 1


      line 2
    `
    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify when only two blank lines present", () => {
    const input = dedent`
      line 1

      line 2
    `
    const expected = dedent`
      line 1

      line 2
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify when only three blank lines present", () => {
    const input = dedent`
      line 1


      line 2
    `
    const expected = dedent`
      line 1


      line 2
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes multiple occurrences of extra blank lines", () => {
    const input = dedent`
      line 1



      line 2



      line 3
    `

    const expected = dedent`
      line 1


      line 2


      line 3
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes many consecutive blank lines", () => {
    const input = dedent`
      line 1




      line 2
    `

    const expected = dedent`
      line 1


      line 2
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles HTML elements with extra blank lines", () => {
    const input = dedent`
      <div>Hello</div>



      <div>World</div>
    `

    const expected = dedent`
      <div>Hello</div>


      <div>World</div>
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles ERB tags with extra blank lines", () => {
    const input = dedent`
      <%= content %>



      <%= other_content %>
    `

    const expected = dedent`
      <%= content %>


      <%= other_content %>
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify file with no extra blank lines", () => {
    const input = dedent`
      line 1
      line 2
      line 3
    `

    const expected = dedent`
      line 1
      line 2
      line 3
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles empty file", () => {
    const input = ''
    const expected = ''

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles file with only newlines", () => {
    const input = '\n\n\n\n\n'
    const expected = '\n\n\n'

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves content before and after extra blank lines", () => {
    const input = dedent`
      <div>
        <h1>Title</h1>



        <p>Content</p>
      </div>
    `

    const expected = dedent`
      <div>
        <h1>Title</h1>


        <p>Content</p>
      </div>
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves content before and after extra blank lines", () => {
    const input = dedent`
      <div>
        <h1>Title</h1>


        <p>Content</p>
      </div>
    `

    const expected = dedent`
      <div>
        <h1>Title</h1>


        <p>Content</p>
      </div>
    `

    const linter = new Linter(Herb, [ERBNoExtraNewLineRule])
    const result = linter.autofix(input, { fileName: 'test.html.erb' })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
