import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import { HTMLBodyOnlyElementsRule } from "../../src/rules/html-body-only-elements.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLBodyOnlyElementsRule)

describe("html-body-only-elements", () => {
  test("passes when elements are inside body", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <title>Test</title>
        </head>
        <body>
          <header>
            <h1>Welcome</h1>
            <nav>
              <ul>
                <li>Home</li>
              </ul>
            </nav>
          </header>
          <main>
            <article>
              <section>
                <p>Content</p>
                <table>
                  <tr><td>Data</td></tr>
                </table>
              </section>
            </article>
            <aside>
              <form>
                <input type="text">
              </form>
            </aside>
          </main>
          <footer>
            <h2>Footer</h2>
          </footer>
        </body>
      </html>
    `)
  })

  test("fails when header is in head", () => {
    expectError("Element `<header>` must be placed inside the `<body>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
          <header>This should not be here</header>
        </head>
        <body>
        </body>
      </html>
    `)
  })

  test("fails when heading is in head", () => {
    expectError("Element `<h1>` must be placed inside the `<body>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
          <h1>Wrong place</h1>
        </head>
        <body>
        </body>
      </html>
    `)
  })

  test("fails when multiple elements are in head", () => {
    expectError("Element `<nav>` must be placed inside the `<body>` tag.")
    expectError("Element `<p>` must be placed inside the `<body>` tag.")
    expectError("Element `<form>` must be placed inside the `<body>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
          <nav>Navigation</nav>
          <p>Paragraph</p>
          <form>Form</form>
        </head>
        <body>
        </body>
      </html>
    `)
  })

  test("passes with valid ERB content in body", () => {
    expectNoOffenses(dedent`
      <html>
        <body>
          <% if user_signed_in? %>
            <header>
              <h1><%= @title %></h1>
            </header>
          <% end %>
        </body>
      </html>
    `)
  })

  describe("tests all body-only elements", () => {
    const bodyOnlyElements = [
      "header", "main", "nav", "section", "footer", "article", "aside", "form",
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "table"
    ]

    bodyOnlyElements.forEach(element => {
      test(`tests ${element} body-only elements`, () => {
        expectError(`Element \`<${element}>\` must be placed inside the \`<body>\` tag.`)

        assertOffenses(dedent`
          <html>
            <head>
              <${element}>Content</${element}>
            </head>
            <body>
            </body>
          </html>
        `)
      })
    })
  })

  test("passes for allowed elements in head", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <title>Page Title</title>
          <meta charset="utf-8">
          <link rel="stylesheet" href="style.css">
          <script src="script.js"></script>
          <style>body { margin: 0; }</style>
        </head>
        <body>
          <h1>Content</h1>
        </body>
      </html>
    `)
  })
})
