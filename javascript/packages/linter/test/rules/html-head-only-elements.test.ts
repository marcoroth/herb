import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import { HTMLHeadOnlyElementsRule } from "../../src/rules/html-head-only-elements.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLHeadOnlyElementsRule)

describe("html-head-only-elements", () => {
  test("passes when head-only elements are inside head", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("passes when ERB helpers are inside head", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("fails when title is in body", () => {
    expectError("Element `<title>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <title>My Page</title>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("passes for head-only elements on the top-level", () => {
    expectNoOffenses(dedent`
      <meta>
      <link>
      <base>
      <title></title>
      <style></style>
    `)
  })

  test.todo("fails for head-only elements on the top-level when other body-elements are present", () => {
    expectNoOffenses(dedent`
      <meta>
      <link>
      <base>
      <title></title>
      <style></style>

      <div></div>
    `)
  })

  test("fails when meta is in body", () => {
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <meta charset="UTF-8">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("passes when meta with itemprop is in body (microdata)", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <div itemscope itemtype="https://schema.org/Book">
            <span itemprop="name">The Hobbit</span>
            <meta itemprop="author" content="J.R.R. Tolkien">
            <meta itemprop="isbn" content="978-0618260300">
          </div>
        </body>
      </html>
    `)
  })

  test("passes when meta with itemprop is deeply nested in body", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <article>
            <div itemscope itemtype="https://schema.org/Product">
              <h1 itemprop="name">Widget</h1>
              <div class="details">
                <meta itemprop="sku" content="12345">
                <span itemprop="price" content="29.99">$29.99</span>
              </div>
            </div>
          </article>
        </body>
      </html>
    `)
  })

  test("fails when meta with name attribute is in body", () => {
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <meta name="description" content="Page description">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails when meta with http-equiv attribute is in body", () => {
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <meta http-equiv="refresh" content="30">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails when meta with charset attribute is in body", () => {
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <meta charset="UTF-8">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails when link is in body", () => {
    expectError("Element `<link>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <link rel="stylesheet" href="/styles.css">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails when style is in body", () => {
    expectError("Element `<style>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <style>body { color: red }</style>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails when base is in body", () => {
    expectError("Element `<base>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
        </head>
        <body>
          <base href="/">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails for multiple head-only elements in body", () => {
    expectError("Element `<title>` must be placed inside the `<head>` tag.")
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")
    expectError("Element `<link>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
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
    `)
  })

  // TODO: this should be handled in https://github.com/marcoroth/herb/issues/638
  test.fails("fails when elements are outside html structure", () => {
    expectError("Element `<title>` must be placed inside the `<head>` tag.")
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <title>My Page</title>
      <meta charset="UTF-8">

      <html>
        <head>
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("works with ERB templates in body", () => {
    expectError("Element `<title>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
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
    `)
  })

  test("allows other elements in body", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("allows title element inside SVG", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("allows nested title elements inside nested SVG", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("allows style element inside SVG", () => {
    expectNoOffenses(dedent`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Hi</title>
        </head>
        <body>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">
            <defs>
              <style>
                .cls-1 {fill:none;stroke:#fff}
              </style>
            </defs>
          </svg>
        </body>
      </html>
    `)
  })

  test("still fails for other head-only elements inside SVG", () => {
    expectError("Element `<meta>` must be placed inside the `<head>` tag.")
    expectError("Element `<link>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <head>
          <title>My Page</title>
        </head>
        <body>
          <svg>
            <meta charset="UTF-8" />
            <link rel="stylesheet" href="/styles.css" />
            <title>Chart Title</title>
          </svg>
        </body>
      </html>
    `)
  })

  test.todo("head in body", () => {
    expectError("Element `<head>` must be placed inside the `<head>` tag.")

    assertOffenses(dedent`
      <html>
        <body>
          <head></head>
        </body>
      </html>
    `)
  })
})
