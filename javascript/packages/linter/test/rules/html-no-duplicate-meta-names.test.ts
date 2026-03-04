import dedent from "dedent"

import { describe, test } from "vitest"
import { createLinterTest } from "../helpers/linter-test-helper.js"

import { HTMLNoDuplicateMetaNamesRule } from "../../src/rules/html-no-duplicate-meta-names.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoDuplicateMetaNamesRule)

describe("html-no-duplicate-meta-names", () => {
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
    expectError('Duplicate `<meta>` tag with `name="description"`. Meta names should be unique within the `<head>` section.')

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

  test("handles nested erb conditionals", () => {
    expectNoOffenses(dedent`
      <head>
        <% if mobile? %>
          <% if ios? %>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <% else %>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <% end %>
        <% end %>
      </head>
    `)
  })

  test.todo("detects duplicates in nested conditionals within same execution path", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the same control flow branch.')

    assertOffenses(dedent`
      <head>
        <% if mobile? %>
          <meta name="viewport" content="width=device-width">
          <% if ios? %>
            <meta name="viewport" content="width=1024">
          <% end %>
        <% end %>
      </head>
    `)
  })

  test("detects static duplicate meta tags in loops", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"` within the same control flow branch. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <% items.each do |item| %>
          <meta name="viewport" content="width=device-width">
          <meta name="viewport" content="width=1024">
        <% end %>
      </head>
    `)
  })

  test("allows dynamic meta tags in loops", () => {
    expectNoOffenses(dedent`
      <head>
        <% keywords.each do |keyword| %>
          <meta name="keyword" content="<%= keyword %>">
        <% end %>
      </head>
    `)
  })

  test("detects duplicate in loop and outside loop", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="viewport" content="width=1024">
        <% items.each do |item| %>
          <meta name="viewport" content="width=device-width">
        <% end %>
      </head>
    `)
  })

  test("resets checking for each head tag", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
        </head>
        <body>
          <h1>First document</h1>
        </body>
      </html>
      <html>
        <head>
          <meta name="viewport" content="width=1024">
        </head>
        <body>
          <h1>Second document</h1>
        </body>
      </html>
    `)
  })

  test("detects duplicates within each head tag separately", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
    expectError('Duplicate `<meta>` tag with `name="description"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <html>
        <head>
          <meta name="viewport" content="width=device-width">
          <meta name="viewport" content="width=1024">
        </head>
      </html>
      <html>
        <head>
          <meta name="description" content="First">
          <meta name="description" content="Second">
        </head>
      </html>
    `)
  })

  test("handles meta tags with whitespace in attribute values", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="  viewport  " content="width=device-width">
        <meta name="viewport" content="width=1024">
      </head>
    `)
  })

  test("treats empty name attributes as different from missing", () => {
    expectNoOffenses(dedent`
      <head>
        <meta name="" content="value1">
        <meta name="" content="value2">
        <meta content="value3">
        <meta content="value4">
      </head>
    `)
  })

  test("detects duplicates in elsif branches", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"` within the same control flow branch. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <% if mobile? %>
          <meta name="description" content="Mobile">
        <% elsif tablet? %>
          <meta name="viewport" content="width=device-width">
          <meta name="viewport" content="width=1024">
        <% else %>
          <meta name="description" content="Desktop">
        <% end %>
      </head>
    `)
  })

  test("allows same meta across if and elsif branches", () => {
    expectNoOffenses(dedent`
      <head>
        <% if mobile? %>
          <meta name="viewport" content="width=device-width">
        <% elsif tablet? %>
          <meta name="viewport" content="width=1024">
        <% end %>
      </head>
    `)
  })

  test("handles conditional inside loop", () => {
    expectNoOffenses(dedent`
      <head>
        <% items.each do |item| %>
          <% if item.mobile? %>
            <meta name="viewport" content="<%= item.viewport %>">
          <% end %>
        <% end %>
      </head>
    `)
  })

  test.todo("detects static duplicate in conditional inside loop", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the same loop iteration.')

    assertOffenses(dedent`
      <head>
        <% items.each do |item| %>
          <% if item.mobile? %>
            <meta name="viewport" content="mobile">
          <% else %>
            <meta name="viewport" content="desktop">
          <% end %>
          <meta name="viewport" content="always">
        <% end %>
      </head>
    `)
  })

  test("handles http-equiv case insensitivity", () => {
    expectError('Duplicate `<meta>` tag with `http-equiv="x-ua-compatible"`. `http-equiv` values should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta http-equiv="x-ua-compatible" content="chrome=1">
      </head>
    `)
  })

  test("detects all duplicate occurrences when there are three or more", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="viewport" content="first">
        <meta name="viewport" content="second">
        <meta name="viewport" content="third">
      </head>
    `)
  })

  test("handles ERB output in name attribute", () => {
    expectNoOffenses(dedent`
      <head>
        <meta name="<%= meta_name_1 %>" content="value1">
        <meta name="<%= meta_name_2 %>" content="value2">
      </head>
    `)
  })

  test.todo("detects duplicates with partial ERB in name", () => {
    expectError('Duplicate `<meta>` tag with `name="prefix-viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="prefix-viewport" content="value1">
        <meta name="prefix-<%= 'viewport' %>" content="value2">
      </head>
    `)
  })

  test("handles unless conditionals", () => {
    expectNoOffenses(dedent`
      <head>
        <% unless mobile? %>
          <meta name="viewport" content="width=1024">
        <% else %>
          <meta name="viewport" content="width=device-width">
        <% end %>
      </head>
    `)
  })

  test("detects duplicates in unless branch", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"` within the same control flow branch. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <% unless mobile? %>
          <meta name="viewport" content="width=1024">
          <meta name="viewport" content="width=768">
        <% end %>
      </head>
    `)
  })

  test("handles document without head tag", () => {
    expectNoOffenses(dedent`
      <html>
        <body>
          <meta name="viewport" content="width=device-width">
          <meta name="viewport" content="width=1024">
        </body>
      </html>
    `)
  })

  test("detects duplicate when meta has both name and http-equiv (edge case)", () => {
    expectError('Duplicate `<meta>` tag with `name="viewport"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="viewport" http-equiv="refresh" content="value1">
        <meta name="viewport" content="value2">
      </head>
    `)
  })

  test("allows same meta in different loop iterations with conditionals", () => {
    expectNoOffenses(dedent`
      <head>
        <% items.each do |item| %>
          <% if item.active? %>
            <meta name="status" content="<%= item.id %>">
          <% end %>
        <% end %>
      </head>
    `)
  })

  test("allows multiple theme-color meta tags with different media attributes", () => {
    expectNoOffenses(dedent`
      <html>
        <head>
          <meta
            name="theme-color"
            content="#ffffff"
            media="(prefers-color-scheme: light)"
          >
          <meta
            name="theme-color"
            content="#212529"
            media="(prefers-color-scheme: dark)"
          >
        </head>
        <body>
          <h1>Welcome</h1>
        </body>
      </html>
    `)
  })

  test("allows multiple meta tags with same name but different media attributes", () => {
    expectNoOffenses(dedent`
      <head>
        <meta name="viewport" content="width=device-width" media="screen">
        <meta name="viewport" content="width=800" media="print">
      </head>
    `)
  })

  test("detects duplicate meta tags with same name and same media attribute", () => {
    expectError('Duplicate `<meta>` tag with `name="theme-color"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: light)">
      </head>
    `)
  })

  test("detects duplicate meta tags with same name and no media attribute", () => {
    expectError('Duplicate `<meta>` tag with `name="theme-color"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="theme-color" content="#ffffff">
        <meta name="theme-color" content="#000000">
      </head>
    `)
  })

  test("allows meta tag with media and another without media for same name", () => {
    expectNoOffenses(dedent`
      <head>
        <meta name="theme-color" content="#ffffff">
        <meta name="theme-color" content="#212529" media="(prefers-color-scheme: dark)">
      </head>
    `)
  })

  test("handles media attribute case insensitivity", () => {
    expectError('Duplicate `<meta>` tag with `name="theme-color"`. Meta names should be unique within the `<head>` section.')

    assertOffenses(dedent`
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: LIGHT)">
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: light)">
      </head>
    `)
  })

  test("allows different meta names with same media attribute", () => {
    expectNoOffenses(dedent`
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
        <meta name="description" content="Light mode page" media="(prefers-color-scheme: light)">
      </head>
    `)
  })
})
