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
      expectError("Extra space detected where there should be no space.")

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
      expectError("Extra space detected where there should be no space.")

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
  })
})
