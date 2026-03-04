import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("incomplete ERB output tag opening", () => {
    const source = `<%`
    const result = formatter.format(source)
    expect(result).toEqual(`<%`)
  })

  test("incomplete ERB output tag with equals", () => {
    const source = `<%=`
    const result = formatter.format(source)
    expect(result).toEqual(`<%=`)
  })

  test("incomplete ERB output tag with content", () => {
    const source = `<%= user.name`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user.name`)
  })

  test("incomplete ERB silent tag opening", () => {
    expectFormattedToMatch(`<%`)
  })

  test("incomplete ERB silent tag with content", () => {
    expectFormattedToMatch(`<% if user`)
  })

  test("incomplete ERB comment tag opening", () => {
    expectFormattedToMatch(`<%#`)
  })

  test("incomplete ERB comment with content", () => {
    expectFormattedToMatch(`<%# This is a comment`)
  })

  test("incomplete ERB tag with single percent", () => {
    expectFormattedToMatch(`<%= user.name %`)
  })

  test("incomplete ERB nested in HTML", () => {
    expectFormattedToMatch(`<div><%= user`)
  })

  test("incomplete ERB with method chaining", () => {
    expectFormattedToMatch(`<%= user.name.upcase`)
  })

  test("incomplete ERB with partial block", () => {
    expectFormattedToMatch(`<% users.each do |user`)
  })

  test("incomplete ERB with partial pipe syntax", () => {
    expectFormattedToMatch(`<% users.each do |`)
  })

  test("incomplete ERB with string literal", () => {
    expectFormattedToMatch(`<%= "Hello`)
  })

  test("incomplete ERB with hash syntax", () => {
    expectFormattedToMatch(`<%= { name:`)
  })

  test("incomplete ERB with array syntax", () => {
    expectFormattedToMatch(`<%= [`)
  })

  test("incomplete ERB with parentheses", () => {
    expectFormattedToMatch(`<%= helper_method(`)
  })

  test("incomplete ERB with instance variable", () => {
    expectFormattedToMatch(`<%= @user`)
  })

  test("incomplete ERB with class variable", () => {
    expectFormattedToMatch(`<%= @@count`)
  })

  test("incomplete ERB with global variable", () => {
    expectFormattedToMatch(`<%= $global`)
  })

  test("incomplete ERB control structure", () => {
    expectFormattedToMatch(`<% if`)
  })

  test("incomplete ERB unless statement", () => {
    expectFormattedToMatch(`<% unless user`)
  })

  test("incomplete ERB case statement", () => {
    expectFormattedToMatch(`<% case user`)
  })

  test("incomplete ERB when clause", () => {
    expectFormattedToMatch(`<% when`)
  })

  test("incomplete ERB for loop", () => {
    expectFormattedToMatch(`<% for user in`)
  })

  test("incomplete ERB while loop", () => {
    expectFormattedToMatch(`<% while user`)
  })

  test("incomplete ERB begin block", () => {
    expectFormattedToMatch(`<% begin`)
  })

  test("incomplete ERB rescue clause", () => {
    expectFormattedToMatch(`<% rescue`)
  })

  test("incomplete ERB ensure clause", () => {
    expectFormattedToMatch(`<% ensure`)
  })

  test("incomplete ERB mixed with HTML attributes", () => {
    expectFormattedToMatch(`<div class="<%= user`)
  })

  test("incomplete ERB in HTML comment", () => {
    expectFormattedToMatch(`<!-- <%= comment`)
  })

  test("incomplete ERB with method call chain", () => {
    expectFormattedToMatch(`<%= user.profile.avatar.url`)
  })

  test("incomplete ERB with Rails helper", () => {
    expectFormattedToMatch(`<%= link_to "Home", root_path,`)
  })

  test("incomplete ERB with nested parentheses", () => {
    expectFormattedToMatch(`<%= render(partial: "shared/header", locals: { title:`)
  })

  test("incomplete ERB with regex literal", () => {
    expectFormattedToMatch(`<%= text.gsub(/pattern`)
  })

  test("incomplete ERB with symbol", () => {
    expectFormattedToMatch(`<%= link_to "Home", :root`)
  })

  test("incomplete ERB with string interpolation", () => {
    expectFormattedToMatch(`<%= "Hello #{user`)
  })

  test("incomplete ERB with conditional operator", () => {
    expectFormattedToMatch(`<%= user.active? ?`)
  })

  test("incomplete ERB with range", () => {
    expectFormattedToMatch(`<%= (1..`)
  })

  test("incomplete ERB with multiple assignment", () => {
    expectFormattedToMatch(`<% a, b =`)
  })

  test("incomplete ERB with block argument", () => {
    expectFormattedToMatch(`<% items.map { |item`)
  })

  test("incomplete ERB with heredoc", () => {
    expectFormattedToMatch(`<%= <<~SQL`)
  })

  test("incomplete ERB with constant", () => {
    expectFormattedToMatch(`<%= API::`)
  })

  test("incomplete ERB with safe navigation", () => {
    expectFormattedToMatch(`<%= user&.`)
  })

  test("incomplete ERB with splat operator", () => {
    expectFormattedToMatch(`<%= method(*`)
  })

  test("incomplete ERB with double splat", () => {
    expectFormattedToMatch(`<%= method(**`)
  })

  test("incomplete ERB with keyword arguments", () => {
    expectFormattedToMatch(`<%= method(name:`)
  })

  test("incomplete ERB content tag with attributes", () => {
    expectFormattedToMatch(`<%= content_tag :div, class:`)
  })

  test("incomplete ERB with nested ERB tags", () => {
    expectFormattedToMatch(`<%= render "user", user: <%= current_user`)
  })

  test("incomplete ERB if statement with incomplete end tag", () => {
    expectFormattedToMatch(`<% if true %> <% end`)
  })

  test("incomplete ERB elsif clause", () => {
    expectFormattedToMatch(`<% elsif user`)
  })

  test("incomplete ERB with trailing operators", () => {
    expectFormattedToMatch(`<%= value +`)
  })

  test("incomplete ERB with incomplete method definition", () => {
    expectFormattedToMatch(`<% def helper`)
  })
})
