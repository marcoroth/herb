import dedent from "dedent"
import { describe, test } from "vitest"

import { createLinterTest } from "../helpers/linter-test-helper.js"
import { HTMLRequireClosingTagsRule } from "../../src/rules/html-require-closing-tags.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLRequireClosingTagsRule)

describe("html-require-closing-tags", () => {
  test("passes for unrelated elements with closing tags", () => {
    expectNoOffenses('<div><span>Hello</span></div>')
  })

  test("passes for void elements", () => {
    expectNoOffenses('<img src="/logo.png" alt="Logo">')
    expectNoOffenses('<br>')
    expectNoOffenses('<hr>')
  })

  describe("with explicit closing tags", () => {
    test("passes for list items", () => {
      expectNoOffenses(dedent`
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      `)
    })

    test("passes for definition list", () => {
      expectNoOffenses(dedent`
        <dl>
          <dt>Term 1</dt>
          <dd>Definition 1</dd>
          <dt>Term 2</dt>
          <dd>Definition 2</dd>
        </dl>
      `)
    })

    test("passes for table", () => {
      expectNoOffenses(dedent`
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
      `)
    })

    test("passes for select options", () => {
      expectNoOffenses(dedent`
        <select>
          <option>Option 1</option>
          <option>Option 2</option>
          <option>Option 3</option>
        </select>
      `)
    })

    test("passes for paragraphs", () => {
      expectNoOffenses(dedent`
        <div>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </div>
      `)
    })
  });

  describe("with omitted closing tags", () => {
    test("fails for list items", () => {
      expectError('Missing explicit closing tag for `<li>`. Use `</li>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<li>`. Use `</li>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<li>`. Use `</li>` instead of relying on implicit tag closing.')

      assertOffenses(dedent`
        <ul>
          <li>Item 1
          <li>Item 2
          <li>Item 3
        </ul>
      `)
    })

    test("fails for definition list", () => {
      expectError('Missing explicit closing tag for `<dt>`. Use `</dt>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<dd>`. Use `</dd>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<dt>`. Use `</dt>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<dd>`. Use `</dd>` instead of relying on implicit tag closing.')

      assertOffenses(dedent`
        <dl>
          <dt>Term 1
          <dd>Definition 1
          <dt>Term 2
          <dd>Definition 2
        </dl>
      `)
    })

    test("fails for table elements", () => {
      expectError('Missing explicit closing tag for `<thead>`. Use `</thead>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<th>`. Use `</th>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<th>`. Use `</th>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<tbody>`. Use `</tbody>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<tr>`. Use `</tr>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<td>`. Use `</td>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<td>`. Use `</td>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<tr>`. Use `</tr>` instead of relying on implicit tag closing.')

      assertOffenses(dedent`
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
      `)
    })

    test("fails for select options", () => {
      expectError('Missing explicit closing tag for `<option>`. Use `</option>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<option>`. Use `</option>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<option>`. Use `</option>` instead of relying on implicit tag closing.')

      assertOffenses(dedent`
        <select>
          <option>Option 1
          <option>Option 2
          <option>Option 3
        </select>
      `)
    })

    test("fails for paragraphs", () => {
      expectError('Missing explicit closing tag for `<p>`. Use `</p>` instead of relying on implicit tag closing.')
      expectError('Missing explicit closing tag for `<p>`. Use `</p>` instead of relying on implicit tag closing.')

      assertOffenses(dedent`
        <div>
          <p>Paragraph 1
          <p>Paragraph 2
        </div>
      `)
    })
  });

  test("only flags elements with omitted closing tags when mixed", () => {
    expectError('Missing explicit closing tag for `<li>`. Use `</li>` instead of relying on implicit tag closing.')
    expectError('Missing explicit closing tag for `<li>`. Use `</li>` instead of relying on implicit tag closing.')

    assertOffenses(dedent`
      <ul>
        <li>Item with omitted closing tag
        <li>Another item</li>
        <li>Back to omitted
      </ul>
    `)
  })
})
