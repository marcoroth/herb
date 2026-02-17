import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLRequireClosingTagsRule } from "../../src/rules/html-require-closing-tags.js"

describe("html-require-closing-tags autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("adds closing tag for list items", () => {
    const input = dedent`
      <ul>
        <li>Item 1
        <li>Item 2
        <li>Item 3
      </ul>
    `
    const expected = dedent`
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
    expect(result.unfixed).toHaveLength(0)
  })

  test("adds closing tags for paragraphs", () => {
    const input = dedent`
      <div>
        <p>Paragraph 1
        <p>Paragraph 2
      </div>
    `
    const expected = dedent`
      <div>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </div>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not add closing tags without content", () => {
    const input = dedent`
      <p>
    `
    const expected = dedent`
      <p>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles nested elements", () => {
    const input = dedent`
      <div>
        <p>Paragraph 1
          <span> with nested span</span>
      </div>
    `
    const expected = dedent`
      <div>
        <p>Paragraph 1
          <span> with nested span</span></p>
      </div>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("adds closing tags for definition lists", () => {
    const input = dedent`
      <dl>
        <dt>Term 1
        <dd>Definition 1
        <dt>Term 2
        <dd>Definition 2
      </dl>
    `
    const expected = dedent`
      <dl>
        <dt>Term 1</dt>
        <dd>Definition 1</dd>
        <dt>Term 2</dt>
        <dd>Definition 2</dd>
      </dl>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(4)
    expect(result.unfixed).toHaveLength(0)
  })

  test("adds closing tags for select options", () => {
    const input = dedent`
      <select>
        <option>Option 1
        <option>Option 2
        <option>Option 3
      </select>
    `
    const expected = dedent`
      <select>
        <option>Option 1</option>
        <option>Option 2</option>
        <option>Option 3</option>
      </select>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify elements that already have closing tags", () => {
    const input = '<div><span>Hello</span></div>'
    const expected = '<div><span>Hello</span></div>'

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify void elements", () => {
    const input = '<img src="/logo.png" alt="Logo">'
    const expected = '<img src="/logo.png" alt="Logo">'

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("handles mixed explicit and omitted closing tags", () => {
    const input = dedent`
      <ul>
        <li>Item with omitted closing tag
        <li>Another item</li>
        <li>Back to omitted
      </ul>
    `
    const expected = dedent`
      <ul>
        <li>Item with omitted closing tag</li>
        <li>Another item</li>
        <li>Back to omitted</li>
      </ul>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("adds closing tags for table cell elements", () => {
    const input = dedent`
      <table>
        <thead>
          <tr>
            <th>Header 1
            <th>Header 2
        <tbody>
          <tr>
            <td>Cell 1
            <td>Cell 2
      </table>
    `
    const expected = dedent`
      <table>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
        </tbody>
      </table>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(8)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserve newlines and indentation for element children", () => {
    const input = dedent`
      <tr><th>Header 1
    `
    const expected = dedent`
      <tr><th>Header 1</th></tr>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not add closing tags without content for element children", () => {
    const input = dedent`
      <tr>
        <th>
    `
    const expected = dedent`
      <tr>
        <th>
    `

    const linter = new Linter(Herb, [HTMLRequireClosingTagsRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })
})
