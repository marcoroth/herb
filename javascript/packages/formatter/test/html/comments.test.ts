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

  test("HTML comment", () => {
    const source = dedent`
      <!-- hello -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- hello -->
    `)
  })

  test("HTML comment with no surrounding spaces", () => {
    const source = dedent`
      <!--hello-->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- hello -->
    `)
  })

  test("formats HTML comments and ERB comments", () => {
    const source = dedent`
      <!-- HTML Comment --><%# ERB Comment %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- HTML Comment -->

      <%# ERB Comment %>
    `)
  })

  test("HTML comment with ERB content inside", () => {
    const source = dedent`
      <div>
        <!-- <%= hello world %> -->
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <!-- <%= hello world %> -->
      </div>
    `)
  })

  test("HTML comment with multiple ERB tags inside", () => {
    const source = dedent`
      <!-- <%= user.name %> - <%= user.email %> -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- <%= user.name %> - <%= user.email %> -->
    `)
  })

  test("HTML comment with ERB and text mixed", () => {
    const source = dedent`
      <!-- User: <%= @user.name %> (ID: <%= @user.id %>) -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- User: <%= @user.name %> (ID: <%= @user.id %>) -->
    `)
  })

  test("multi-line HTML comment with ERB content", () => {
    const source = dedent`
      <!--
        TODO: Fix this <%= bug_type %>
        Assigned to: <%= developer.name %>
        Due: <%= deadline.strftime('%Y-%m-%d') %>
      -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!--
        TODO: Fix this <%= bug_type %>
        Assigned to: <%= developer.name %>
        Due: <%= deadline.strftime('%Y-%m-%d') %>
      -->
    `)
  })

  test("multi-line HTML comment with ERB if", () => {
    const source = dedent`
      <!--
        <% if Rails.env.development? %>
          Debug info: <%= current_user&.email %>
        <% end %>
      -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!--
        <% if Rails.env.development? %>
          Debug info: <%= current_user&.email %>
        <% end %>
      -->
    `)
  })

  test.todo("indents multi-line HTML comment with ERB if", () => {
    const source = dedent`
      <!--
      <% if Rails.env.development? %>
      Debug info: <%= current_user&.email %>
      <% end %>
      -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!--
        <% if Rails.env.development? %>
          Debug info: <%= current_user&.email %>
        <% end %>
      -->
    `)
  })

  test("HTML comment spanning multiple lines with inline ERB", () => {
    const source = dedent`
      <!-- Status: <%= status %> |
           Updated: <%= updated_at %> |
           Version: <%= version %> -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!--
        Status: <%= status %> |
        Updated: <%= updated_at %> |
        Version: <%= version %>
      -->
    `)
  })

  test("multi-line HTML comment with ERB gets indented", () => {
    const source = dedent`
      <!--
      Status: <%= status %> |
      Updated: <%= updated_at %> |
      Version: <%= version %>
      -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!--
        Status: <%= status %> |
        Updated: <%= updated_at %> |
        Version: <%= version %>
      -->
    `)
  })

  test("multi-line HTML comment gets indented", () => {
    const source = dedent`
      <!--
      Comment
      on
      multiple
      lines
      -->
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!--
        Comment
        on
        multiple
        lines
      -->
    `)
  })
})
