import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLNoSpaceInTagRule } from "../../src/rules/html-no-space-in-tag.js"

describe("HTMLNoSpaceInTagRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("when space is correct", () => {
    test("opening tag", () => {
      const html = dedent`
        <div>
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("closing tag", () => {
      const html = dedent`
        </div>
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("opening tag with attributes", () => {
      const html = dedent`
        <div class="foo">
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("multi line tag", () => {
      const html = dedent`
        <input
          type="password"
          class="foo"
        >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("tag with erb", () => {
      const html = dedent`
        <input <%= attributes %>>
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("multi line tag with erb", () => {
      const html = dedent`
        <input
          type="password"
          <%= attributes %>
          class="foo"
        >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("multi line tag with erb nested", () => {
      const html = dedent`
        <div>
          <input
            type="password"
            <%= attributes %>
            class="foo"
          >
        </div>
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.offenses).toHaveLength(0)
    })
  })

  describe("when no space should be present", () => {
    test("after name", () => {
      const html = dedent`
        <div ></div>
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

    test("after end solidus", () => {
      const html = dedent`
        </div >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

  })

  describe("when extra space is present", () => {
    
    test("between name and first attribute", () => {
      const html = dedent`
        <img  class="hide">
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

    test("between attributes", () => {
      const html = dedent`
        <div foo='foo'      bar='bar'>·
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

    test("extra newline between name and first attribute", ()=> {
      const html = dedent`
        <input

          type="password"
        >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

    test("extra newline between name and end of tag", ()=> {
      const html = dedent`
        <input

        >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

    test("extra newline between attributes", ()=> {
      const html = dedent`
        <input
          type="password"

          class="foo"
        >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })

    test("end of tag is on newline with trailing whitespace", ()=> {
      const html = dedent`
        <input
          type="password"
          class="foo"
          >
      `
      const linter = new Linter(Herb, [HTMLNoSpaceInTagRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-no-space-in-tag")
      expect(lintResult.offenses[0].message).toBe("Extra space detected where there should be no space.")
    })
  })
})
