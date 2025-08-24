import dedent from "dedent"
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

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for uppercase tag names", () => {
    const html = '<DIV class="container"><SPAN>Hello</SPAN></DIV>'

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4) // DIV open, DIV close, SPAN open, SPAN close
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(4)

    expect(lintResult.offenses[0].rule).toBe("html-tag-name-lowercase")
    expect(lintResult.offenses[0].severity).toBe("error")

    expect(lintResult.offenses[0].message).toBe('Opening tag name `<DIV>` should be lowercase. Use `<div>` instead.')
    expect(lintResult.offenses[1].message).toBe('Opening tag name `<SPAN>` should be lowercase. Use `<span>` instead.')
    expect(lintResult.offenses[2].message).toBe('Closing tag name `</SPAN>` should be lowercase. Use `</span>` instead.')
    expect(lintResult.offenses[3].message).toBe('Closing tag name `</DIV>` should be lowercase. Use `</div>` instead.')
  })

  test("fails for mixed case tag names", () => {
    const html = '<Div class="container"><Span>Hello</Span></Div>'

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(4)

    expect(lintResult.offenses[0].message).toBe('Opening tag name `<Div>` should be lowercase. Use `<div>` instead.')
  })

  test("handles self-closing tags", () => {
    const html = '<IMG src="photo.jpg" />'

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Opening tag name `<IMG>` should be lowercase. Use `<img>` instead.')
  })

  test("passes for valid self-closing tags", () => {
    const html = '<img src="photo.jpg" />'

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test.skip("handles ERB templates", () => {
    const html = '<div class="container"><%= content_tag(:DIV, "Hello world!") %></div>'

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles common HTML5 elements", () => {
    const html = dedent`
      <article>
        <header><h1>Title</h1></header>
        <section>
          <p>Content</p>
          <aside>Sidebar</aside>
        </section>
        <footer>Footer</footer>
      </article>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for uppercase HTML5 elements", () => {
    const html = dedent`
      <ARTICLE>
        <HEADER><H1>Title</H1></HEADER>
        <SECTION>
          <P>Content</P>
          <ASIDE>Sidebar</ASIDE>
        </SECTION>
        <FOOTER>Footer</FOOTER>
      </ARTICLE>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(14)
    expect(lintResult.warnings).toBe(0)

    const errorMessages = lintResult.offenses.map(message => message.message)
    expect(errorMessages.some(msg => msg.includes('ARTICLE'))).toBe(true)
    expect(errorMessages.some(msg => msg.includes('HEADER'))).toBe(true)
    expect(errorMessages.some(msg => msg.includes('H1'))).toBe(true)
  })

  test("handles empty tags", () => {
    const html = '<div></div>'

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles nested ERB within HTML", () => {
    const html = dedent`
      <div class="<%= user.active? ? 'active' : 'inactive' %>">
        <h1><%= user.name %></h1>
        <% if user.admin? %>
          <span class="admin-badge">Admin</span>
        <% end %>
      </div>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores SVG child elements (handled by svg-tag-name-capitalization rule)", () => {
    const html = `
      <svg>
        <linearGradient id="grad1">
          <stop offset="0%" />
        </linearGradient>
        <LINEARGRADIENT id="grad2">
          <stop offset="100%" />
        </LINEARGRADIENT>
        <lineargradient id="grad3">
          <stop offset="50%" />
        </lineargradient>
      </svg>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("still checks SVG tag itself for lowercase", () => {
    const html = `
      <SVG>
        <linearGradient id="grad1">
          <stop offset="0%" />
        </linearGradient>
      </SVG>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2) // opening and closing SVG tags
    expect(lintResult.offenses[0].message).toBe('Opening tag name `<SVG>` should be lowercase. Use `<svg>` instead.')
    expect(lintResult.offenses[1].message).toBe('Closing tag name `</SVG>` should be lowercase. Use `</svg>` instead.')
  })

  test("is disabled when XMLDeclarationNode is present", () => {
    const xml = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <ROOT>
        <ELEMENT>Content</ELEMENT>
      </ROOT>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(xml)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("still works normally without XMLDeclarationNode", () => {
    const html = dedent`
      <ROOT>
        <ELEMENT>Content</ELEMENT>
      </ROOT>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4) // ROOT open, ELEMENT open, ELEMENT close, ROOT close
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(4)
  })

  test("is disabled with complex XML document", () => {
    const xml = dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <CATALOG>
        <BOOK id="1">
          <TITLE>XML Guide</TITLE>
          <AUTHOR>John Doe</AUTHOR>
          <PRICE>29.99</PRICE>
        </BOOK>
        <BOOK id="2">
          <TITLE>HTML Basics</TITLE>
          <AUTHOR>Jane Smith</AUTHOR>
          <PRICE>19.99</PRICE>
        </BOOK>
      </CATALOG>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(xml)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("still works normally for regular .erb files", () => {
    const htmlErb = dedent`
      <DIV>
        <%= render 'shared/header' %>
        <SECTION>Content</SECTION>
      </DIV>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(htmlErb, { fileName: 'template.html.erb' })

    expect(lintResult.errors).toBe(4) // DIV open, DIV close, SECTION open, SECTION close
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(4)
  })

  test("is disabled for .xml.erb files", () => {
    const xmlErb = dedent`
      <CONFIGURATION>
        <%= render 'shared/settings' %>
        <DATABASE>
          <HOST><%= db_host %></HOST>
          <PORT><%= db_port %></PORT>
        </DATABASE>
      </CONFIGURATION>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(xmlErb, { fileName: 'config.xml.erb' })

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("handles .xml.erb files without XMLDeclarationNode", () => {
    const xmlErb = dedent`
      <FEED>
        <% items.each do |item| %>
          <ITEM>
            <TITLE><%= item.title %></TITLE>
            <DESCRIPTION><%= item.description %></DESCRIPTION>
          </ITEM>
        <% end %>
      </FEED>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(xmlErb, { fileName: 'feed.xml.erb' })

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("is disabled for .xml files", () => {
    const xml = dedent`
      <CONFIGURATION>
        <DATABASE>
          <HOST>localhost</HOST>
          <PORT>5432</PORT>
        </DATABASE>
      </CONFIGURATION>
    `

    const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
    const lintResult = linter.lint(xml, { fileName: 'config.xml' })

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
