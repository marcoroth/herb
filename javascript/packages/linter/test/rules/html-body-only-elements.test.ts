import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLBodyOnlyElementsRule } from "../../src/rules/html-body-only-elements.js"

describe("html-body-only-elements", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes when elements are inside body", () => {
    const html = `
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
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails when header is in head", () => {
    const html = `
      <html>
        <head>
          <header>This should not be here</header>
        </head>
        <body>
        </body>
      </html>
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-body-only-elements")
    expect(lintResult.offenses[0].message).toBe("Element `<header>` must be placed inside the `<body>` tag.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails when heading is in head", () => {
    const html = `
      <html>
        <head>
          <h1>Wrong place</h1>
        </head>
        <body>
        </body>
      </html>
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("Element `<h1>` must be placed inside the `<body>` tag.")
  })

  test("fails when multiple elements are in head", () => {
    const html = `
      <html>
        <head>
          <nav>Navigation</nav>
          <p>Paragraph</p>
          <form>Form</form>
        </head>
        <body>
        </body>
      </html>
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.offenses).toHaveLength(3)
    expect(lintResult.offenses[0].message).toBe("Element `<nav>` must be placed inside the `<body>` tag.")
    expect(lintResult.offenses[1].message).toBe("Element `<p>` must be placed inside the `<body>` tag.")
    expect(lintResult.offenses[2].message).toBe("Element `<form>` must be placed inside the `<body>` tag.")
  })

  test("fails when elements are outside html structure", () => {
    const html = `
      <header>Outside HTML</header>
      <html>
        <body>
          <p>Inside body</p>
        </body>
      </html>
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("Element `<header>` must be placed inside the `<body>` tag.")
  })

  test("passes with valid ERB content in body", () => {
    const html = `
      <html>
        <body>
          <% if user_signed_in? %>
            <header>
              <h1><%= @title %></h1>
            </header>
          <% end %>
        </body>
      </html>
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("tests all body-only elements", () => {
    const bodyOnlyElements = [
      "header", "main", "nav", "section", "footer", "article", "aside", "form",
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "table"
    ]

    bodyOnlyElements.forEach(element => {
      const html = `
        <html>
          <head>
            <${element}>Content</${element}>
          </head>
          <body>
          </body>
        </html>
      `
      
      const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(1)
      expect(lintResult.offenses[0].message).toBe(`Element \`<${element}>\` must be placed inside the \`<body>\` tag.`)
    })
  })

  test("passes for allowed elements in head", () => {
    const html = `
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
    `
    
    const linter = new Linter(Herb, [HTMLBodyOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})