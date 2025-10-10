import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoSpaceInTagRule } from "../../src/rules/html-no-space-in-tag.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoSpaceInTagRule)

describe.skip("HTMLNoSpaceInTagRule", () => {
  describe("when space is correct", () => {
    test("plain opening tag", () => {
      expectNoOffenses(`<div>`)
    })

    test("closing tag", () => {
      expectNoOffenses(`</div>`)
    })

    test("tag with no name", () => {
      expectNoOffenses(`</>`)
    })

    test("empty tag", () => {
      expectNoOffenses(`<>`)
    })

    test.fails("void tag", () => {
      expectNoOffenses(`<img />`)
    })

    test("plain tag with attribute", () => {
      expectNoOffenses(`<div class="foo">`)
    })

    test.fails("between attributes", () => {
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
  })

  describe("when no space should be present", () => {
    test("after name", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div   >`)
    })

    test.fails("before name", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<   div>`)
    })

    test.fails("before start solidus", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<   /div>`)
    })

    test("after start solidus", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`</   div>`)
    })

    test("after end solidus", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div /   >`)
    })

    test.fails("between attribute name and equal", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div foo  ='bar'>`)
    })

    test.fails("between attribute equal and value", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div foo=  'bar'>`)
    })
  })

  describe("when space is missing", () => {
    test("between attributes", () => {
      expectError("No space detected where there should be a single space.")
      assertOffenses(`<div foo='foo'bar='bar'>`)
    })

    test.fails("between last attribute and solidus", () => {
      expectError("No space detected where there should be a single space.")
      assertOffenses(`<div foo='bar'/>`)
    })

    test.fails("between name and solidus", () => {
      expectError("No space detected where there should be a single space.")
      assertOffenses(`<div/>`)
    })
  })

  describe("when extra space is present", () => {
    test("between name and end of tag", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<div  >`)
    })

    test("between name and first attribute", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(`<img   class="hide">`)
    })

    test.fails("between name and end solidus", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(`<br   />`)
    })

    test.fails("between last attribute and solidus", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(`<br class="hide"   />`)
    })

    test("between last attribute and end of tag", () => {
      expectError("Extra space detected where there should be no space.")
      assertOffenses(`<img class="hide"    >`)
    })

    test.fails("between attributes", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(`<div foo='foo'      bar='bar'>`)
    })

    test.fails("extra newline between name and first attribute", () => {
      expectError("Extra space detected where there should be a single space or a single line break.")
      assertOffenses(dedent`
        <input

          type="password" />
      `)
    })

    test.fails("extra newline between name and end of tag", () => {
      expectError("Extra space detected where there should be a single space.")
      assertOffenses(dedent`
        <input

          />
      `)
    })

    test.fails("extra newline between attributes", () => {
      expectError("Extra space detected where there should be a single space or a single line break.")
      assertOffenses(dedent`
        <input
          type="password"

          class="foo" />
      `)
    })

    test.fails("end solidus is on newline", () => {
      expectError("Extra space detected where there should be a single space.")
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

    test.fails("non-space detected between name and attribute", () => {
      expectError('Non-whitespace character(s) detected: "/".')
      assertOffenses(`<input/class="hide" />`)
    })

    test.fails("non-space detected between attributes", () => {
      expectError('Non-whitespace character(s) detected: "/".')
      assertOffenses(`<input class="hide"/name="foo" />`)
    })
  })
})
