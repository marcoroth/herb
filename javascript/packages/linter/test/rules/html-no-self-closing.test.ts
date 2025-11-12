import { describe, test, beforeAll, expect } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../../src/linter.js"
import { HTMLNoSelfClosingRule } from "../../src/rules/html-no-self-closing.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoSelfClosingRule)

describe("html-no-self-closing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for standard HTML tags", () => {
    expectNoOffenses(`
      <div></div>
      <span></span>
      <section></section>
      <custom-element></custom-element>
      <img src="/logo.png" alt="Logo">
      <input type="text">
      <br>
      <hr>
    `)
  })

  test("fails for self-closing non-void elements", () => {
    expectError('Use `<div></div>` instead of self-closing `<div />` for HTML compatibility.')
    expectError('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    expectError('Use `<section></section>` instead of self-closing `<section />` for HTML compatibility.')
    expectError('Use `<custom-element></custom-element>` instead of self-closing `<custom-element />` for HTML compatibility.')
    expectError('Use `<svg></svg>` instead of self-closing `<svg />` for HTML compatibility.')
    assertOffenses(`
      <div />
      <span />
      <section />
      <custom-element />
      <svg />
    `)
  })

  test("fails for self-closing void elements", () => {
    expectError('Use `<img>` instead of self-closing `<img />` for HTML compatibility.')
    expectError('Use `<input>` instead of self-closing `<input />` for HTML compatibility.')
    expectError('Use `<br>` instead of self-closing `<br />` for HTML compatibility.')
    expectError('Use `<hr>` instead of self-closing `<hr />` for HTML compatibility.')
    assertOffenses(`
      <img src="/logo.png" alt="Logo" />
      <input type="text" />
      <br />
      <hr />
    `)
  })

  test("passes for mixed correct and incorrect tags", () => {
    expectError('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    expectError('Use `<input>` instead of self-closing `<input />` for HTML compatibility.')
    assertOffenses(`
      <div></div>
      <span />
      <input type="text">
      <input type="text" />
    `)
  })

  test("passes for nested non-self-closing tags", () => {
    expectNoOffenses(`
      <div>
        <span></span>
        <section></section>
      </div>
    `)
  })

  test("fails for nested self-closing tags", () => {
    expectError('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    expectError('Use `<section></section>` instead of self-closing `<section />` for HTML compatibility.')
    assertOffenses(`
      <div>
        <span />
        <section />
      </div>
    `)
  })

  test("passes for custom elements without self-closing", () => {
    expectNoOffenses(`
      <custom-element></custom-element>
      <another-custom></another-custom>
    `)
  })

  test("fails for custom elements with self-closing", () => {
    expectError('Use `<custom-element></custom-element>` instead of self-closing `<custom-element />` for HTML compatibility.')
    expectError('Use `<another-custom></another-custom>` instead of self-closing `<another-custom />` for HTML compatibility.')
    assertOffenses(`
      <custom-element />
      <another-custom />
    `)
  })

  test("passes for void elements without self-closing", () => {
    expectNoOffenses(`
      <img src="/logo.png" alt="Logo">
      <input type="text">
      <br>
      <hr>
    `)
  })

  test("passes for self-closing elements inside SVG", () => {
    expectNoOffenses(`
      <div class="flex items-center text-xs text-gray-500 mt-1">
        <svg class="w-3 h-3 mr-1 fill-gray-400" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          <circle cx="12" cy="12" r="10" />
          <rect x="0" y="0" width="24" height="24" />
        </svg>
      </div>
    `)
  })

  test("fails for self-closing elements outside SVG but passes inside SVG", () => {
    expectError('Use `<div></div>` instead of self-closing `<div />` for HTML compatibility.')
    expectError('Use `<span></span>` instead of self-closing `<span />` for HTML compatibility.')
    assertOffenses(`
      <div />
      <svg class="w-3 h-3" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      <span />
    `)
  })

  describe("ActionMailer exclusion", () => {
    test("excludes ActionMailer view files without any config", () => {
      const linter = Linter.from(Herb)
      const source = '<br />'

      const result1 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/views/user_mailer/welcome.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(false)

      const result3 = linter.lint(source, { fileName: "app/views/notifications_mailer/alert.html.erb" })
      expect(result3.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(false)
    })

    test("excludes ActionMailer view files from the rule by default", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-no-self-closing": {}
          }
        }
      }, { projectPath: "/test/project" })

      const linter = Linter.from(Herb, config)
      const source = '<br />'

      const result1 = linter.lint(source, { fileName: "app/views/home/index.html.erb" })
      expect(result1.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(true)

      const result2 = linter.lint(source, { fileName: "app/views/user_mailer/welcome.html.erb" })
      expect(result2.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(false)

      const result3 = linter.lint(source, { fileName: "app/views/notifications_mailer/alert.html.erb" })
      expect(result3.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(false)
    })

    test("can override default exclusion pattern if needed", () => {
      const config = Config.fromObject({
        linter: {
          rules: {
            "html-no-self-closing": {
              exclude: [] // Override the default exclusion
            }
          }
        }
      }, { projectPath: "/test/project" })

      const linter = Linter.from(Herb, config)
      const source = '<br />'

      const result = linter.lint(source, { fileName: "app/views/user_mailer/welcome.html.erb" })
      expect(result.offenses.some(offense => offense.rule === "html-no-self-closing")).toBe(true)
    })
  })
})
