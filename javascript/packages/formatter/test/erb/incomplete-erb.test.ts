import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("incomplete ERB output tag opening", () => {
    const source = dedent`<%`
    const result = formatter.format(source)
    expect(result).toEqual(`<%`)
  })

  test("incomplete ERB output tag with equals", () => {
    const source = dedent`<%=`
    const result = formatter.format(source)
    expect(result).toEqual(`<%=`)
  })

  test("incomplete ERB output tag with content", () => {
    const source = dedent`<%= user.name`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user.name`)
  })

  test("incomplete ERB silent tag opening", () => {
    const source = dedent`<%`
    const result = formatter.format(source)
    expect(result).toEqual(`<%`)
  })

  test("incomplete ERB silent tag with content", () => {
    const source = dedent`<% if user`
    const result = formatter.format(source)
    expect(result).toEqual(`<% if user `)
  })

  test("incomplete ERB comment tag opening", () => {
    const source = dedent`<%#`
    const result = formatter.format(source)
    expect(result).toEqual(`<%#`)
  })

  test("incomplete ERB comment with content", () => {
    const source = dedent`<%# This is a comment`
    const result = formatter.format(source)
    expect(result).toEqual(`<%# This is a comment`)
  })

  test("incomplete ERB tag with single percent", () => {
    const source = dedent`<%= user.name %`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user.name %`)
  })

  test("incomplete ERB nested in HTML", () => {
    const source = dedent`<div><%= user`
    const result = formatter.format(source)
    expect(result).toEqual(`<div><%= user`)
  })

  test("incomplete ERB with method chaining", () => {
    const source = dedent`<%= user.name.upcase`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user.name.upcase`)
  })

  test("incomplete ERB with partial block", () => {
    const source = dedent`<% users.each do |user`
    const result = formatter.format(source)
    expect(result).toEqual(`<% users.each do |user `)
  })

  test("incomplete ERB with partial pipe syntax", () => {
    const source = dedent`<% users.each do |`
    const result = formatter.format(source)
    expect(result).toEqual(`<% users.each do | `)
  })

  test("incomplete ERB with string literal", () => {
    const source = dedent`<%= "Hello`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= "Hello`)
  })

  test("incomplete ERB with hash syntax", () => {
    const source = dedent`<%= { name:`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= { name:`)
  })

  test("incomplete ERB with array syntax", () => {
    const source = dedent`<%= [`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= [`)
  })

  test("incomplete ERB with parentheses", () => {
    const source = dedent`<%= helper_method(`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= helper_method(`)
  })

  test("incomplete ERB with instance variable", () => {
    const source = dedent`<%= @user`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= @user`)
  })

  test("incomplete ERB with class variable", () => {
    const source = dedent`<%= @@count`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= @@count`)
  })

  test("incomplete ERB with global variable", () => {
    const source = dedent`<%= $global`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= $global`)
  })

  test("incomplete ERB control structure", () => {
    const source = dedent`<% if`
    const result = formatter.format(source)
    expect(result).toEqual(`<% if `)
  })

  test("incomplete ERB unless statement", () => {
    const source = dedent`<% unless user`
    const result = formatter.format(source)
    expect(result).toEqual(`<% unless user `)
  })

  test("incomplete ERB case statement", () => {
    const source = dedent`<% case user`
    const result = formatter.format(source)
    expect(result).toEqual(`<% case user `)
  })

  test("incomplete ERB when clause", () => {
    const source = dedent`<% when`
    const result = formatter.format(source)
    expect(result).toEqual(`<% when`)
  })

  test("incomplete ERB for loop", () => {
    const source = dedent`<% for user in`
    const result = formatter.format(source)
    expect(result).toEqual(`<% for user in `)
  })

  test("incomplete ERB while loop", () => {
    const source = dedent`<% while user`
    const result = formatter.format(source)
    expect(result).toEqual(`<% while user `)
  })

  test("incomplete ERB begin block", () => {
    const source = dedent`<% begin`
    const result = formatter.format(source)
    expect(result).toEqual(`<% begin `)
  })

  test("incomplete ERB rescue clause", () => {
    const source = dedent`<% rescue`
    const result = formatter.format(source)
    expect(result).toEqual(`<% rescue`)
  })

  test("incomplete ERB ensure clause", () => {
    const source = dedent`<% ensure`
    const result = formatter.format(source)
    expect(result).toEqual(`<% ensure`)
  })

  test("incomplete ERB mixed with HTML attributes", () => {
    const source = dedent`<div class="<%= user`
    const result = formatter.format(source)
    expect(result).toEqual(`<div class="<%= user`)
  })

  test("incomplete ERB in HTML comment", () => {
    const source = dedent`<!-- <%= comment`
    const result = formatter.format(source)
    expect(result).toEqual(`<!-- <%= comment`)
  })

  test("incomplete ERB with method call chain", () => {
    const source = dedent`<%= user.profile.avatar.url`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user.profile.avatar.url`)
  })

  test("incomplete ERB with Rails helper", () => {
    const source = dedent`<%= link_to "Home", root_path,`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= link_to "Home", root_path,`)
  })

  test("incomplete ERB with nested parentheses", () => {
    const source = dedent`<%= render(partial: "shared/header", locals: { title:`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= render(partial: "shared/header", locals: { title:`)
  })

  test("incomplete ERB with regex literal", () => {
    const source = dedent`<%= text.gsub(/pattern`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= text.gsub(/pattern`)
  })

  test("incomplete ERB with symbol", () => {
    const source = dedent`<%= link_to "Home", :root`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= link_to "Home", :root`)
  })

  test("incomplete ERB with string interpolation", () => {
    const source = dedent`<%= "Hello #{user`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= "Hello #{user`)
  })

  test("incomplete ERB with conditional operator", () => {
    const source = dedent`<%= user.active? ?`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user.active? ?`)
  })

  test("incomplete ERB with range", () => {
    const source = dedent`<%= (1..`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= (1..`)
  })

  test("incomplete ERB with multiple assignment", () => {
    const source = dedent`<% a, b =`
    const result = formatter.format(source)
    expect(result).toEqual(`<% a, b =`)
  })

  test("incomplete ERB with block argument", () => {
    const source = dedent`<% items.map { |item`
    const result = formatter.format(source)
    expect(result).toEqual(`<% items.map { |item `)
  })

  test("incomplete ERB with heredoc", () => {
    const source = dedent`<%= <<~SQL`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= <<~SQL`)
  })

  test("incomplete ERB with constant", () => {
    const source = dedent`<%= API::`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= API::`)
  })

  test("incomplete ERB with safe navigation", () => {
    const source = dedent`<%= user&.`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= user&.`)
  })

  test("incomplete ERB with splat operator", () => {
    const source = dedent`<%= method(*`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= method(*`)
  })

  test("incomplete ERB with double splat", () => {
    const source = dedent`<%= method(**`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= method(**`)
  })

  test("incomplete ERB with keyword arguments", () => {
    const source = dedent`<%= method(name:`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= method(name:`)
  })

  test("incomplete ERB content tag with attributes", () => {
    const source = dedent`<%= content_tag :div, class:`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= content_tag :div, class:`)
  })

  test("incomplete ERB with nested ERB tags", () => {
    const source = dedent`<%= render "user", user: <%= current_user`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= render "user", user: <%= current_user`)
  })

  test("incomplete ERB if statement with incomplete end tag", () => {
    const source = dedent`<% if true %> <% end`
    const result = formatter.format(source)
    expect(result).toEqual(`<% if true %> <% end`)
  })

  test("incomplete ERB elsif clause", () => {
    const source = dedent`<% elsif user`
    const result = formatter.format(source)
    expect(result).toEqual(`<% elsif user`)
  })

  test("incomplete ERB with trailing operators", () => {
    const source = dedent`<%= value +`
    const result = formatter.format(source)
    expect(result).toEqual(`<%= value +`)
  })

  test("incomplete ERB with incomplete method definition", () => {
    const source = dedent`<% def helper`
    const result = formatter.format(source)
    expect(result).toEqual(`<% def helper`)
  })
})
