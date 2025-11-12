import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLTagNameLowercaseRule)

describe("html-tag-name-lowercase", () => {
  test("passes for lowercase tag names", () => {
    expectNoOffenses('<div class="container"><span>Hello</span></div>')
  })

  test("fails for uppercase tag names", () => {
    expectError('Opening tag name `<DIV>` should be lowercase. Use `<div>` instead.')
    expectError('Opening tag name `<SPAN>` should be lowercase. Use `<span>` instead.')
    expectError('Closing tag name `</SPAN>` should be lowercase. Use `</span>` instead.')
    expectError('Closing tag name `</DIV>` should be lowercase. Use `</div>` instead.')

    assertOffenses('<DIV class="container"><SPAN>Hello</SPAN></DIV>')
  })

  test("fails for mixed case tag names", () => {
    expectError('Opening tag name `<Div>` should be lowercase. Use `<div>` instead.')
    expectError('Opening tag name `<Span>` should be lowercase. Use `<span>` instead.')
    expectError('Closing tag name `</Span>` should be lowercase. Use `</span>` instead.')
    expectError('Closing tag name `</Div>` should be lowercase. Use `</div>` instead.')

    assertOffenses('<Div class="container"><Span>Hello</Span></Div>')
  })

  test("handles self-closing tags", () => {
    expectError('Opening tag name `<IMG>` should be lowercase. Use `<img>` instead.')

    assertOffenses('<IMG src="photo.jpg" />')
  })

  test("passes for valid self-closing tags", () => {
    expectNoOffenses('<img src="photo.jpg" />')
  })

  test.skip("handles ERB templates", () => {
    expectNoOffenses('<div class="container"><%= content_tag(:DIV, "Hello world!") %></div>')
  })

  test("handles common HTML5 elements", () => {
    expectNoOffenses(dedent`
      <article>
        <header><h1>Title</h1></header>
        <section>
          <p>Content</p>
          <aside>Sidebar</aside>
        </section>
        <footer>Footer</footer>
      </article>
    `)
  })

  test("fails for uppercase HTML5 elements", () => {
    expectError('Opening tag name `<ARTICLE>` should be lowercase. Use `<article>` instead.')
    expectError('Opening tag name `<HEADER>` should be lowercase. Use `<header>` instead.')
    expectError('Opening tag name `<H1>` should be lowercase. Use `<h1>` instead.')
    expectError('Closing tag name `</H1>` should be lowercase. Use `</h1>` instead.')
    expectError('Closing tag name `</HEADER>` should be lowercase. Use `</header>` instead.')
    expectError('Opening tag name `<SECTION>` should be lowercase. Use `<section>` instead.')
    expectError('Opening tag name `<P>` should be lowercase. Use `<p>` instead.')
    expectError('Closing tag name `</P>` should be lowercase. Use `</p>` instead.')
    expectError('Opening tag name `<ASIDE>` should be lowercase. Use `<aside>` instead.')
    expectError('Closing tag name `</ASIDE>` should be lowercase. Use `</aside>` instead.')
    expectError('Closing tag name `</SECTION>` should be lowercase. Use `</section>` instead.')
    expectError('Opening tag name `<FOOTER>` should be lowercase. Use `<footer>` instead.')
    expectError('Closing tag name `</FOOTER>` should be lowercase. Use `</footer>` instead.')
    expectError('Closing tag name `</ARTICLE>` should be lowercase. Use `</article>` instead.')

    assertOffenses(dedent`
      <ARTICLE>
        <HEADER><H1>Title</H1></HEADER>
        <SECTION>
          <P>Content</P>
          <ASIDE>Sidebar</ASIDE>
        </SECTION>
        <FOOTER>Footer</FOOTER>
      </ARTICLE>
    `)
  })

  test("handles empty tags", () => {
    expectNoOffenses('<div></div>')
  })

  test("handles nested ERB within HTML", () => {
    expectNoOffenses(dedent`
      <div class="<%= user.active? ? 'active' : 'inactive' %>">
        <h1><%= user.name %></h1>
        <% if user.admin? %>
          <span class="admin-badge">Admin</span>
        <% end %>
      </div>
    `)
  })

  test("ignores SVG child elements (handled by svg-tag-name-capitalization rule)", () => {
    expectNoOffenses(`
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
    `)
  })

  test("still checks SVG tag itself for lowercase", () => {
    expectError('Opening tag name `<SVG>` should be lowercase. Use `<svg>` instead.')
    expectError('Closing tag name `</SVG>` should be lowercase. Use `</svg>` instead.')

    assertOffenses(`
      <SVG>
        <linearGradient id="grad1">
          <stop offset="0%" />
        </linearGradient>
      </SVG>
    `)
  })

  test("is disabled when XMLDeclarationNode is present", () => {
    expectNoOffenses(dedent`
      <?xml version="1.0" encoding="UTF-8"?>
      <ROOT>
        <ELEMENT>Content</ELEMENT>
      </ROOT>
    `)
  })

  test("still works normally without XMLDeclarationNode", () => {
    expectError('Opening tag name `<ROOT>` should be lowercase. Use `<root>` instead.')
    expectError('Opening tag name `<ELEMENT>` should be lowercase. Use `<element>` instead.')
    expectError('Closing tag name `</ELEMENT>` should be lowercase. Use `</element>` instead.')
    expectError('Closing tag name `</ROOT>` should be lowercase. Use `</root>` instead.')

    assertOffenses(dedent`
      <ROOT>
        <ELEMENT>Content</ELEMENT>
      </ROOT>
    `)
  })

  test("is disabled with complex XML document", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("still works normally for regular .erb files", () => {
    expectError('Opening tag name `<DIV>` should be lowercase. Use `<div>` instead.')
    expectError('Opening tag name `<SECTION>` should be lowercase. Use `<section>` instead.')
    expectError('Closing tag name `</SECTION>` should be lowercase. Use `</section>` instead.')
    expectError('Closing tag name `</DIV>` should be lowercase. Use `</div>` instead.')

    assertOffenses(dedent`
      <DIV>
        <%= render 'shared/header' %>
        <SECTION>Content</SECTION>
      </DIV>
    `)
  })

  test("is disabled for .xml.erb files", () => {
    expectNoOffenses(dedent`
      <CONFIGURATION>
        <%= render 'shared/settings' %>
        <DATABASE>
          <HOST><%= db_host %></HOST>
          <PORT><%= db_port %></PORT>
        </DATABASE>
      </CONFIGURATION>
    `, { fileName: "config.xml.erb" })
  })

  test("handles .xml.erb files without XMLDeclarationNode", () => {
    expectNoOffenses(dedent`
      <FEED>
        <% items.each do |item| %>
          <ITEM>
            <TITLE><%= item.title %></TITLE>
            <DESCRIPTION><%= item.description %></DESCRIPTION>
          </ITEM>
        <% end %>
      </FEED>
    `, { fileName: "feed.xml.erb" })
  })

  test("is disabled for .xml files", () => {
    expectNoOffenses(dedent`
      <CONFIGURATION>
        <DATABASE>
          <HOST>localhost</HOST>
          <PORT>5432</PORT>
        </DATABASE>
      </CONFIGURATION>
    `, { fileName: "config.xml" })
  })
})
