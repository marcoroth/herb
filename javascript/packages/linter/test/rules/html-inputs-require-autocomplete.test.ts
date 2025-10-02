import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLInputsRequireAutocompleteRule } from "../../src/rules/html-inputs-require-autocomplete.js"

describe("HTMLInputsRequireAutocompleteRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("HTML cases", () => { 
    test("when autocomplete is present on input types", () => {
        const html = dedent`
          <input type="email" autocomplete="foo">
        `
        const linter = new Linter(Herb, [HTMLInputsRequireAutocompleteRule])
        const lintResult = linter.lint(html)
      
        expect(lintResult.offenses).toHaveLength(0)
    })
  
    test("when input type does not require autocomplete attribute and it is not present", () => {
        const html = dedent`
          <input type="bar">
        `
        const linter = new Linter(Herb, [HTMLInputsRequireAutocompleteRule])
        const lintResult = linter.lint(html)
      
        expect(lintResult.offenses).toHaveLength(0)
    })
  
    test("when input type requires autocomplete attribute and it is not present", () => {
      const html = dedent`
        <input type="email">
      `
      const linter = new Linter(Herb, [HTMLInputsRequireAutocompleteRule])
      const lintResult = linter.lint(html)
  
      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].code).toBe("html-inputs-require-autocomplete")
      expect(lintResult.offenses[0].message).toBe("Input tag is missing an autocomplete attribute. If no autocomplete behaviour is desired, use the value `off` or `nope`.")
    })
  })

  describe("input field helpers linting", () => {

    const formHelpersRequiringAutocomplete = [
      'date_field_tag',
      'color_field_tag',
      'email_field_tag',
      'text_field_tag',
      'utf8_enforcer_tag',
      'month_field_tag',
      'number_field_tag',
      'password_field_tag',
      'search_field_tag',
      'telephone_field_tag',
      'time_field_tag',
      'url_field_tag',
      'week_field_tag',
    ]

    formHelpersRequiringAutocomplete.forEach(formHelper => {
      test(`usage of "${formHelper}" helper with autocomplete value`, () => {
        const html = dedent`
          <%= text_field_tag 'foo', autocomplete: 'foo' %>
        `
        const linter = new Linter(Herb, [HTMLInputsRequireAutocompleteRule])
        const lintResult = linter.lint(html)
    
        expect(lintResult.offenses).toHaveLength(0)
      })
  
      test(`usage of "${formHelper}" helper without autocomplete value`, () => {
        const html = dedent`
          <%= ${formHelper} 'foo' autocomplete: 'foo' %>
        `
        const linter = new Linter(Herb, [HTMLInputsRequireAutocompleteRule])
        const lintResult = linter.lint(html)
    
        expect(lintResult.errors).toBe(1)
        expect(lintResult.offenses).toHaveLength(1)
        expect(lintResult.offenses[0].code).toBe("html-inputs-require-autocomplete")
        expect(lintResult.offenses[0].message).toBe("Input tag is missing an autocomplete attribute. If no autocomplete behaviour is desired, use the value `off` or `nope`.")
      })
    });

  })
})
