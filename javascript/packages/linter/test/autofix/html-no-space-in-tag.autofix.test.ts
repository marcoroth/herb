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
      expect(result.fixed).toHaveLength(2)
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
      expect(result.fixed).toHaveLength(2)
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
  })
})
