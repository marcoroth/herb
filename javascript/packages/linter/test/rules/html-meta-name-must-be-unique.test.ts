import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HTMLMetaNameMustBeUniqueRule } from "../../src/rules/html-meta-name-must-be-unique.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLMetaNameMustBeUniqueRule)

describe("html-meta-name-must-be-unique", () => {
  test("passes when meta names are unique", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("passes when http-equiv values are unique", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("passes when mixing name and http-equiv attributes", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("fails when meta names are duplicated", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="viewport" content="width=1024">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails when http-equiv values are duplicated", () => {
    expectError('Duplicate `<meta>` tag with `http-equiv="X-UA-Compatible"`. `http-equiv` values should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <html>
        <head>
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta http-equiv="X-UA-Compatible" content="chrome=1">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("handles case insensitive duplicates", () => {
    expectError('Duplicate `<meta>` tag with `name="Description"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <html>
        <head>
          <meta name="Description" content="Welcome to our site">
          <meta name="description" content="Another description">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("fails with multiple duplicates", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
    expectError('Duplicate `<meta>` tag with `name="description"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
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
    `)
  })

  test("ignores meta tags without name or http-equiv attributes", () => {
    expectNoOffenses(dedent`
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
    `)
  })

  test("only checks meta tags inside head", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <meta name="viewport" content="width=1024">
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("works with ERB templates", () => {
    expectError('Duplicate `<meta>` tag with `name="description"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <html>
        <head>
          <meta name="description" content="<%= @page_description %>">
          <meta name="description" content="<%= @fallback_description %>">
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("handles self-closing meta tags", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="viewport" content="width=1024" />
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("handles mixed name and http-equiv duplicates", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
    expectError('Duplicate `<meta>` tag with `http-equiv="refresh"`. `http-equiv` values should be unique within the `<head>` section.')

    assertOffenses(dedent`
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
    `)
  })

  test("handles erb conditionals", () => {
    expectNoOffenses(dedent`
      <head>
        <% if mobile? %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% elsif hotwire_native_app? %>
          <meta name="viewport" content="width=1024">
        <% else %>
          <meta name="viewport" content="width=1024">
        <% end %>
      </head>
    `)
  })

  test("detects duplicates when meta tags are outside and inside erb conditionals", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="viewport" content="width=1024">

        <% if mobile? %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% end %>
      </head>
    `)
  })

  test("detects duplicates between global meta tag and erb else branch", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="viewport" content="width=1024">

        <% if mobile? %>
          <meta http-equiv="refresh" content="30">
        <% else %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% end %>
      </head>
    `)
  })

  test("detects duplicates when meta tag is outside erb conditional block", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <% if mobile? %>
          <meta http-equiv="refresh" content="30">
        <% else %>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <% end %>

        <meta name="viewport" content="width=1024">
      </head>
    `)
  })
})
