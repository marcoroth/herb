import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

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
    const source = `<%`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB silent tag with content", () => {
    const source = `<% if user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB comment tag opening", () => {
    const source = `<%#`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB comment with content", () => {
    const source = `<%# This is a comment`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB tag with single percent", () => {
    const source = `<%= user.name %`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB nested in HTML", () => {
    const source = `<div><%= user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with method chaining", () => {
    const source = `<%= user.name.upcase`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with partial block", () => {
    const source = `<% users.each do |user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with partial pipe syntax", () => {
    const source = `<% users.each do |`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with string literal", () => {
    const source = `<%= "Hello`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with hash syntax", () => {
    const source = `<%= { name:`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with array syntax", () => {
    const source = `<%= [`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with parentheses", () => {
    const source = `<%= helper_method(`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with instance variable", () => {
    const source = `<%= @user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with class variable", () => {
    const source = `<%= @@count`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with global variable", () => {
    const source = `<%= $global`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB control structure", () => {
    const source = `<% if`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB unless statement", () => {
    const source = `<% unless user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB case statement", () => {
    const source = `<% case user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB when clause", () => {
    const source = `<% when`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB for loop", () => {
    const source = `<% for user in`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB while loop", () => {
    const source = `<% while user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB begin block", () => {
    const source = `<% begin`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB rescue clause", () => {
    const source = `<% rescue`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB ensure clause", () => {
    const source = `<% ensure`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB mixed with HTML attributes", () => {
    const source = `<div class="<%= user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB in HTML comment", () => {
    const source = `<!-- <%= comment`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with method call chain", () => {
    const source = `<%= user.profile.avatar.url`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with Rails helper", () => {
    const source = `<%= link_to "Home", root_path,`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with nested parentheses", () => {
    const source = `<%= render(partial: "shared/header", locals: { title:`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with regex literal", () => {
    const source = `<%= text.gsub(/pattern`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with symbol", () => {
    const source = `<%= link_to "Home", :root`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with string interpolation", () => {
    const source = `<%= "Hello #{user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with conditional operator", () => {
    const source = `<%= user.active? ?`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with range", () => {
    const source = `<%= (1..`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with multiple assignment", () => {
    const source = `<% a, b =`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with block argument", () => {
    const source = `<% items.map { |item`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with heredoc", () => {
    const source = `<%= <<~SQL`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with constant", () => {
    const source = `<%= API::`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with safe navigation", () => {
    const source = `<%= user&.`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with splat operator", () => {
    const source = `<%= method(*`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with double splat", () => {
    const source = `<%= method(**`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with keyword arguments", () => {
    const source = `<%= method(name:`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB content tag with attributes", () => {
    const source = `<%= content_tag :div, class:`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with nested ERB tags", () => {
    const source = `<%= render "user", user: <%= current_user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB if statement with incomplete end tag", () => {
    const source = `<% if true %> <% end`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB elsif clause", () => {
    const source = `<% elsif user`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with trailing operators", () => {
    const source = `<%= value +`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })

  test("incomplete ERB with incomplete method definition", () => {
    const source = `<% def helper`
    const result = formatter.format(source)
    expect(result).toEqual(source)
  })
})
