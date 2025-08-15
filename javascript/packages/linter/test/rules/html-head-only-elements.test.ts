import { Herb } from "@herb-tools/node-wasm"
import { beforeAll, describe, expect, test } from "vitest"
import dedent from "dedent"
import { Linter } from "../../src/linter.js"
import { HTMLHeadOnlyElementsRule } from "../../src/rules/html-head-only-elements.js"

describe("html-head-only-elements", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes when head-only elements are inside head", () => {
    const html = dedent`
      <html>
        <head>
          <title>My Page</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="/styles.css">
          <style>body { color: red }</style>
          <base href="/">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes when ERB helpers are inside head", () => {
    const html = dedent`
      <html>
        <head>
          <%= csrf_meta_tags %>
          <%= csp_meta_tag %>
          <%= favicon_link_tag 'favicon.ico' %>
          <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
          <title><%= content_for?(:title) ? yield(:title) : "Default Title" %></title>
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails when title is in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <title>My Page</title>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<title>` element should only be used inside the `<head>` section.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails when meta is in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <meta charset="UTF-8">
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<meta>` element should only be used inside the `<head>` section.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails when link is in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <link rel="stylesheet" href="/styles.css">
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<link>` element should only be used inside the `<head>` section.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails when style is in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <style>body { color: red }</style>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<style>` element should only be used inside the `<head>` section.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails when base is in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <base href="/">
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<base>` element should only be used inside the `<head>` section.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails for multiple head-only elements in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <title>My Page</title>
          <meta charset="UTF-8">
          <link rel="stylesheet" href="/styles.css">
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(3)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<title>` element should only be used inside the `<head>` section.")

    expect(lintResult.offenses[1].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[1].message).toBe("The `<meta>` element should only be used inside the `<head>` section.")

    expect(lintResult.offenses[2].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[2].message).toBe("The `<link>` element should only be used inside the `<head>` section.")
  })

  test("fails when elements are outside html structure", () => {
    const html = dedent`
      <title>My Page</title>
      <meta charset="UTF-8">
      <html>
        <head>
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<title>` element should only be used inside the `<head>` section.")

    expect(lintResult.offenses[1].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[1].message).toBe("The `<meta>` element should only be used inside the `<head>` section.")
  })

  test("works with ERB templates in body", () => {
    const html = dedent`
      <html>
        <head>
        </head>
        <body>
          <%= csrf_meta_tags %>
          <%= csp_meta_tag %>
          <%= favicon_link_tag 'favicon.ico' %>
          <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
          <title><%= content_for?(:title) ? yield(:title) : "Default Title" %></title>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<title>` element should only be used inside the `<head>` section.")
  })

  test("allows other elements in body", () => {
    const html = dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <h1>Welcome</h1>
          <p>This is content</p>
          <div>
            <span>Some text</span>
          </div>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("allows title element inside SVG", () => {
    const html = dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <svg>
            <title>Chart Title</title>
            <rect width="100" height="100"/>
          </svg>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("allows nested title elements inside nested SVG", () => {
    const html = dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <div>
            <svg>
              <g>
                <title>Group Title</title>
                <rect width="100" height="100"/>
              </g>
            </svg>
          </div>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("still fails for other head-only elements inside SVG", () => {
    const html = dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <svg>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="/styles.css">
            <title>Chart Title</title>
          </svg>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLHeadOnlyElementsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[0].message).toBe("The `<meta>` element should only be used inside the `<head>` section.")
    
    expect(lintResult.offenses[1].rule).toBe("html-head-only-elements")
    expect(lintResult.offenses[1].message).toBe("The `<link>` element should only be used inside the `<head>` section.")
  })
})
