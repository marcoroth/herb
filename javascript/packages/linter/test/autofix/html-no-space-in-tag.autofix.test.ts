import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLNoSpaceInTagRule } from "../../src/rules/html-no-space-in-tag.js"

describe("html-no-space-in-tag autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("when space is correct", () => {
    test("void tag", () => {
      const input = `<img />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("plain tag with attribute", () => {
      const input = `<div class="foo"></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between attributes", () => {
      const input = `<input class="foo" name="bar">`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("multi line tag", () => {
      const input = dedent`
        <input
          type="password"
          class="foo"
        >
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("tag with erb", () => {
      const input = dedent`<input <%= attributes %>>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("multi line tag with erb", () => {
      const input = dedent`
        <input
          type="password"
          <%= attributes %>
          class="foo"
        >
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })
      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("multi line tag with erb nested", () => {
      const input = dedent`
        <div>
          <input
            type="password"
            <%= attributes %>
            class="foo"
          >
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("multi line tag with first attribute on the opening line (hanging indent) - #695", () => {
      const input = dedent`
        <div data-a="foo"
             data-b="bar">
          lorem
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not merge unindented attributes on separate lines", () => {
      const input = dedent`
        <a
        href="https://example.com/path"
        target="_blank">TOTP</a>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("does not merge unindented ERB attributes on separate lines", () => {
      const input = dedent`
        <div
        data-base-path="<%= a %>"
        data-available-locales="<%= b %>">z</div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(input)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })
  })

  describe("when no space should be present", () => {
    test("after name", () => {
      const input = dedent`<div   ></div>`
      const expected = dedent`<div></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("before name", () => {
      const input = dedent`<   div></div>`
      const expected = dedent`<   div></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("before start solidus", () => {
      const input = dedent`<div><   /div>`
      const expected = dedent`<div><   /div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("after start solidus", () => {
      const input = dedent`<div></   div>`
      const expected = dedent`<div></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("after end solidus", () => {
      const input = dedent`<div><div /   >`
      const expected = dedent`<div><div /   >`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })
  })

  describe("when space is missing", () => {
    test("between attributes", () => {
      const input = dedent`<div foo='foo'bar='bar'></div>`
      const expected = dedent`<div foo='foo'bar='bar'></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between last attribute and solidus", () => {
      const input = dedent`<div foo='bar'/>`
      const expected = dedent`<div foo='bar' />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between name and solidus", () => {
      const input = `<div/>`
      const expected = `<div />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })
  })

  describe("when extra space is present", () => {
    test("between name and end of tag", () => {
      const input = dedent`<div  ></div>`
      const expected = dedent`<div></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between name and first attribute", () => {
      const input = dedent`<img   class="hide">`
      const expected = dedent`<img class="hide">`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between name and end solidus", () => {
      const input = dedent`<br   />`
      const expected = dedent`<br />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between last attribute and solidus", () => {
      const input = dedent`<br class="hide"   />`
      const expected = dedent`<br class="hide" />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between last attribute and end of tag", () => {
      const input = dedent`<img class="hide"    >`
      const expected = dedent`<img class="hide">`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("between attributes", () => {
      const input = dedent`<div foo='foo'      bar='bar'></div>`
      const expected = dedent`<div foo='foo' bar='bar'></div>`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("extra newline between name and first attribute", () => {
      const input = dedent`
        <input

          type="password" />
      `
      const expected = dedent`
        <input
          type="password" />
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("extra newline between name and end of tag", () => {
      const input = dedent`
        <input

          />
      `
      const expected = dedent`
        <input
        />
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(2)
      expect(result.unfixed).toHaveLength(0)
    })

    test("extra newline between attributes", () => {
      const input = dedent`
        <input
          type="password"

          class="foo" />
      `
      const expected = dedent`
        <input
          type="password"
          class="foo" />
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("end solidus is on newline", () => {
      const input = dedent`
        <input
          type="password"
          class="foo"
          />
      `
      const expected = dedent`
        <input
          type="password"
          class="foo"
        />
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("end of tag is on newline", () => {
      const input = dedent`
        <input
          type="password"
          class="foo"
          >
      `
      const expected = dedent`
        <input
          type="password"
          class="foo"
        >
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("non-space detected between name and attribute", () => {
      const input = `<input/class="hide" />`
      const expected = `<input/class="hide" />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("non-space detected between attributes", () => {
      const input = `<input class="hide"/name="foo" />`
      const expected = `<input class="hide"/name="foo" />`

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(0)
      expect(result.unfixed).toHaveLength(0)
    })

    test("collapses extra space between name and first attribute on the opening line", () => {
      const input = dedent`
        <div  data-a="foo"
          data-b="bar">
        </div>
      `
      const expected = dedent`
        <div data-a="foo"
          data-b="bar">
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("collapses extra space between attributes on a continuation line", () => {
      const input = dedent`
        <div
          data-a="foo"  data-b="bar">
        </div>
      `
      const expected = dedent`
        <div
          data-a="foo" data-b="bar">
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes space before the closing bracket on an attribute line", () => {
      const input = dedent`
        <div
          data-a="foo" >
        </div>
      `
      const expected = dedent`
        <div
          data-a="foo">
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("aligns an over-indented closing bracket to the tag column in a nested tag", () => {
      const input = dedent`
        <div>
          <input
            type="password"
              >
        </div>
      `
      const expected = dedent`
        <div>
          <input
            type="password"
          >
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("aligns an over-indented self-closing bracket to the tag column in a nested tag", () => {
      const input = dedent`
        <div>
          <input
            type="password"
              />
        </div>
      `
      const expected = dedent`
        <div>
          <input
            type="password"
          />
        </div>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })

    test("removes a genuine blank line between unindented attributes", () => {
      const input = dedent`
        <a
        href="x"

        target="_blank">y</a>
      `
      const expected = dedent`
        <a
        href="x"
        target="_blank">y</a>
      `

      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const result = linter.autofix(input, { fileName: 'test.html.erb' })

      expect(result.source).toBe(expected)
      expect(result.fixed).toHaveLength(1)
      expect(result.unfixed).toHaveLength(0)
    })
  })
})
