import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoSpaceInTagRule } from "../../src/rules/html-no-space-in-tag.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoSpaceInTagRule)

describe("HTMLNoSpaceInTagRule", () => {
  describe("when space is correct", () => {
    test("plain opening tag", () => {
      expectNoOffenses(`<div>`, { allowInvalidSyntax: true })
    })

    test("closing tag", () => {
      expectNoOffenses(`</div>`, { allowInvalidSyntax: true })
    })

    test("tag with no name", () => {
      expectNoOffenses(`</>`)
    })

    test("empty tag", () => {
      expectNoOffenses(`<>`)
    })

    test("void tag", () => {
      expectNoOffenses(`<img />`)
    })

    test("plain tag with attribute", () => {
      expectNoOffenses(`<div class="foo"></div>`)
    })

    test("between attributes", () => {
      expectNoOffenses(`<input class="foo" name="bar">`)
    })

    test("multi line tag", () => {
      expectNoOffenses(dedent`
        <input
          type="password"
          class="foo"
        >
      `)
    })

    test("tag with erb", () => {
      expectNoOffenses(`<input <%= attributes %>>`)
    })

    test("multi line tag with erb", () => {
      expectNoOffenses(dedent`
        <input
          type="password"
          <%= attributes %>
          class="foo"
        >
      `)
    })

    test("multi line tag with erb nested", () => {
      expectNoOffenses(dedent`
        <div>
          <input
            type="password"
            <%= attributes %>
            class="foo"
          >
        </div>
      `)
    })

    test("multi line tag with first attribute on the opening line (hanging indent) - #695", () => {
      expectNoOffenses(dedent`
        <div data-a="foo"
             data-b="bar">
          lorem
        </div>
      `)
    })

    test("multi line tag with attributes aligned to a non-default indentation", () => {
      expectNoOffenses(dedent`
        <div class="a"
             id="b"
             data-c="c">
        </div>
      `)
    })

    test("multi line tag with unindented attributes on separate lines", () => {
      expectNoOffenses(dedent`
        <a
        href="https://example.com/path"
        target="_blank">TOTP</a>
      `)
    })

    test("multi line tag with unindented ERB attributes on separate lines", () => {
      expectNoOffenses(dedent`
        <div
        data-base-path="<%= a %>"
        data-available-locales="<%= b %>">z</div>
      `)
    })
  })

  describe("when no space should be present", () => {
    test("after name", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div   ></div>`)
    })

    test("before name", () => {
      expectNoOffenses(`<   div></div>`, { allowInvalidSyntax: true })
    })

    test("before start solidus", () => {
      expectNoOffenses(`<div><   /div>`, { allowInvalidSyntax: true })
    })

    test("after start solidus", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div></   div>`)
    })

    test("after end solidus", () => {
      expectNoOffenses(`<div><div /   >`, { allowInvalidSyntax: true })
    })
  })

  describe("when space is missing", () => {
    test("between attributes", () => {
      expectNoOffenses(`<div foo='foo'bar='bar'></div>`, { allowInvalidSyntax: true })
    })

    test("between last attribute and solidus", () => {
      expectError("No space detected where there should be a single space.")
      assertOffenses(`<div foo='bar'/>`)
    })

    test("between name and solidus", () => {
      expectError("No space detected where there should be a single space.")
      assertOffenses(`<div/>`)
    })
  })

  describe("when extra space is present", () => {
    test("between name and end of tag", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div  ></div>`)
    })

    test("between name and first attribute", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(`<img   class="hide">`)
    })

    test("between name and end solidus", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<br   />`)
    })

    test("between last attribute and solidus", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<br class="hide"   />`)
    })

    test("between last attribute and end of tag", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<img class="hide"    >`)
    })

    test("between attributes", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(`<div foo='foo'      bar='bar'></div>`)
    })

    test("extra newline between name and first attribute", () => {
      expectError("Extra space detected where there should be a single space or a single line break.")

      assertOffenses(dedent`
        <input

          type="password" />
      `)
    })

    test("extra newline between name and end of tag", () => {
      expectError("Extra space detected where there should be a single space or a single line break.")
      expectError("Extra space detected where there should be no space.")

      assertOffenses(dedent`
        <input

          />
      `)
    })

    test("extra newline between attributes", () => {
      expectError("Extra space detected where there should be a single space or a single line break.")

      assertOffenses(dedent`
        <input
          type="password"

          class="foo" />
      `)
    })

    test("end solidus is on newline", () => {
      expectError("Extra space detected where there should be no space.")

      assertOffenses(dedent`
        <input
          type="password"
          class="foo"
          />
      `)
    })

    test("end of tag is on newline", () => {
      expectError("Extra space detected where there should be no space.")

      assertOffenses(dedent`
        <input
          type="password"
          class="foo"
          >
      `)
    })

    test("non-space detected between name and attribute", () => {
      expectNoOffenses(`<input/class="hide" />`, { allowInvalidSyntax: true })
    })

    test("non-space detected between attributes", () => {
      expectNoOffenses(`<input class="hide"/name="foo" />`, { allowInvalidSyntax: true })
    })

    test("extra space between name and first attribute on the opening line of a multiline tag", () => {
      expectError("Extra space detected where there should be a single space.", [1, 4])

      assertOffenses(dedent`
        <div  data-a="foo"
          data-b="bar">
        </div>
      `)
    })

    test("extra space between attributes on a continuation line", () => {
      expectError("Extra space detected where there should be a single space.", [2, 14])

      assertOffenses(dedent`
        <div
          data-a="foo"  data-b="bar">
        </div>
      `)
    })

    test("extra space before the closing bracket on an attribute line", () => {
      expectError("Extra space detected where there should be no space.", [2, 14])

      assertOffenses(dedent`
        <div
          data-a="foo" >
        </div>
      `)
    })

    test("closing bracket over-indented in a nested tag", () => {
      expectError("Extra space detected where there should be no space.", [4, 0])

      assertOffenses(dedent`
        <div>
          <input
            type="password"
              >
        </div>
      `)
    })

    test("blank line between unindented attributes on separate lines", () => {
      expectError("Extra space detected where there should be a single space or a single line break.", [3, 0])

      assertOffenses(dedent`
        <a
        href="x"

        target="_blank">y</a>
      `)
    })
  })
})
