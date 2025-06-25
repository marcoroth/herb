import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"

describe("html-tag-name-lowercase", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for lowercase tag names", () => {
    const html = '<div class="container"><span>Hello</span></div>'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("fails for uppercase tag names", () => {
    const html = '<DIV class="container"><SPAN>Hello</SPAN></DIV>'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(4) // DIV open, DIV close, SPAN open, SPAN close
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(4)

    expect(lintResult.messages[0].rule).toBe("html-tag-name-lowercase")
    expect(lintResult.messages[0].message).toContain('Tag name "DIV" should be lowercase')
    expect(lintResult.messages[0].severity).toBe("error")
  })

  test("fails for mixed case tag names", () => {
    const html = '<Div class="container"><Span>Hello</Span></Div>'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(4)

    expect(lintResult.messages[0].message).toContain('Tag name "Div" should be lowercase')
  })

  test("handles self-closing tags", () => {
    const html = '<IMG src="photo.jpg" />'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toContain('Tag name "IMG" should be lowercase')
  })

  test("passes for valid self-closing tags", () => {
    const html = '<img src="photo.jpg" />'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles ERB templates", () => {
    const html = '<div class="container"><%= content_tag(:DIV, "Hello world!") %></div>'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    // Should only lint HTML tags, not Ruby code inside ERB
    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles common HTML5 elements", () => {
    const html = `
      <article>
        <header><h1>Title</h1></header>
        <section>
          <p>Content</p>
          <aside>Sidebar</aside>
        </section>
        <footer>Footer</footer>
      </article>
    `
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for uppercase HTML5 elements", () => {
    const html = `
      <ARTICLE>
        <HEADER><H1>Title</H1></HEADER>
        <SECTION>
          <P>Content</P>
          <ASIDE>Sidebar</ASIDE>
        </SECTION>
        <FOOTER>Footer</FOOTER>
      </ARTICLE>
    `
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBeGreaterThan(0)
    expect(lintResult.warnings).toBe(0)

    const errorMessages = lintResult.messages.map(message => message.message)
    expect(errorMessages.some(msg => msg.includes('ARTICLE'))).toBe(true)
    expect(errorMessages.some(msg => msg.includes('HEADER'))).toBe(true)
    expect(errorMessages.some(msg => msg.includes('H1'))).toBe(true)
  })

  test("handles empty tags", () => {
    const html = '<div></div>'
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles nested ERB within HTML", () => {
    const html = `
      <div class="<%= user.active? ? 'active' : 'inactive' %>">
        <h1><%= user.name %></h1>
        <% if user.admin? %>
          <span class="admin-badge">Admin</span>
        <% end %>
      </div>
    `
    const result = Herb.parse(html)
    const linter = new Linter([new HTMLTagNameLowercaseRule()])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
