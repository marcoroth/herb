import { Herb } from "@herb-tools/node-wasm"
import { beforeAll, describe, expect, test } from "vitest"
import dedent from "dedent"
import { Linter } from "../../src/linter.js"
import { HTMLMetaNameMustBeUniqueRule } from "../../src/rules/html-meta-name-must-be-unique.js"

describe("html-meta-name-must-be-unique", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes when meta names are unique", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="description" content="Welcome to our site">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="author" content="John Doe">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes when http-equiv values are unique", () => {
    const html = dedent`
      <html>
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta http-equiv="refresh" content="30">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes when mixing name and http-equiv attributes", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="description" content="Welcome to our site">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails when meta names are duplicated", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="viewport" content="width=1024">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails when http-equiv values are duplicated", () => {
    const html = dedent`
      <html>
        <head>
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta http-equiv="X-UA-Compatible" content="chrome=1">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `http-equiv="X-UA-Compatible"`. `http-equiv` values should be unique within the `<head>` section.')
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("handles case insensitive duplicates", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="Description" content="Welcome to our site">
          <meta name="description" content="Another description">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="Description"`. Meta names should be unique within the `<head>` section.')
  })

  test("fails with multiple duplicates", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="viewport" content="width=1024">
          <meta name="description" content="First description">
          <meta name="description" content="Second description">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    expect(lintResult.offenses[1].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[1].message).toBe('Duplicate `<meta>` tag with `name="description"`. Meta names should be unique within the `<head>` section.')
  })

  test("ignores meta tags without name or http-equiv attributes", () => {
    const html = dedent`
      <html>
        <head>
          <meta charset="UTF-8">
          <meta charset="ISO-8859-1">
          <meta property="og:title" content="Page Title">
          <meta property="og:title" content="Another Title">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("only checks meta tags inside head", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <meta name="viewport" content="width=1024">
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("works with ERB templates", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="description" content="<%= @page_description %>">
          <meta name="description" content="<%= @fallback_description %>">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="description"`. Meta names should be unique within the `<head>` section.')
  })

  test("handles self-closing meta tags", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="viewport" content="width=1024" />
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
  })

  test("handles mixed name and http-equiv duplicates", () => {
    const html = dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="viewport" content="width=1024">
          <meta http-equiv="refresh" content="30">
          <meta http-equiv="refresh" content="60">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    expect(lintResult.offenses[1].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[1].message).toBe('Duplicate `<meta>` tag with `http-equiv="refresh"`. `http-equiv` values should be unique within the `<head>` section.')
  })

  test("handles erb conditionals", () => {
    const html = dedent`
      <head>
        <% if mobile? %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% elsif hotwire_native_app? %>
          <meta name="viewport" content="width=1024">
        <% else %>
          <meta name="viewport" content="width=1024">
        <% end %>
      </head>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("detects duplicates when meta tags are outside and inside erb conditionals", () => {
    const html = dedent`
      <head>
        <meta name="viewport" content="width=1024">

        <% if mobile? %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% end %>
      </head>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
  })

  test("detects duplicates between global meta tag and erb else branch", () => {
    const html = dedent`
      <head>
        <meta name="viewport" content="width=1024">

        <% if mobile? %>
          <meta http-equiv="refresh" content="30">
        <% else %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% end %>
      </head>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
  })

  test("detects duplicates when meta tag is outside erb conditional block", () => {
    const html = dedent`
      <head>
        <% if mobile? %>
          <meta http-equiv="refresh" content="30">
        <% else %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% end %>

        <meta name="viewport" content="width=1024">
      </head>
    `

    const linter = new Linter(Herb, [HTMLMetaNameMustBeUniqueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-meta-name-must-be-unique")
    expect(lintResult.offenses[0].message).toBe('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
  })
})
