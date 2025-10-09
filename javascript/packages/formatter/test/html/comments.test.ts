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

  test("formats HTML comments and ERB comments on the same line", () => {
    const source = dedent`
      <!-- HTML Comment --><%# ERB Comment %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <!-- HTML Comment --><%# ERB Comment %>
    `)
  })

  test("formats HTML comments and ERB comments on mutli-line", () => {
    const source = dedent`
      <!-- HTML Comment -->
      <%# ERB Comment %>
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

  test.fails("indents multi-line HTML comment with ERB if", () => {
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

  describe("Mixed content with comments", () => {
    test("div with comment and another element stays multiline", () => {
      const source = dedent`
        <div>
          <!-- This is a comment -->
          <p>Some content</p>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- This is a comment -->
          <p>Some content</p>
        </div>
      `)
    })

    test("div with comment and text content stays multiline", () => {
      const source = dedent`
        <div>
          <!-- Important note -->
          Some text content here
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- Important note -->
          Some text content here
        </div>
      `)
    })

    test("div with comment and ERB expression stays multiline", () => {
      const source = dedent`
        <div>
          <!-- User info -->
          <%= current_user.name %>
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- User info -->
          <%= current_user.name %>
        </div>
      `)
    })

    test("div with multiple comments and elements stays multiline", () => {
      const source = dedent`
        <div>
          <!-- Header comment -->
          <h1>Title</h1>
          <!-- Body comment -->
          <p>Content</p>
          <!-- Footer comment -->
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- Header comment -->
          <h1>Title</h1>

          <!-- Body comment -->
          <p>Content</p>

          <!-- Footer comment -->
        </div>
      `)
    })

    test("nested elements with comments stay multiline", () => {
      const source = dedent`
        <section>
          <div>
            <!-- Section comment -->
            <span>Inline content</span>
          </div>
        </section>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <section>
          <div>
            <!-- Section comment -->
            <span>Inline content</span>
          </div>
        </section>
      `)
    })

    test("comment with ERB in mixed content stays multiline", () => {
      const source = dedent`
        <article>
          <!-- Debug: <%= Rails.env %> -->
          <h2>Article Title</h2>
          <p>Article content goes here.</p>
        </article>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <article>
          <!-- Debug: <%= Rails.env %> -->
          <h2>Article Title</h2>

          <p>Article content goes here.</p>
        </article>
      `)
    })

    test("div with only a comment uses multiline formatting", () => {
      const source = dedent`
        <div>
          <!-- Only a comment here -->
        </div>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <div>
          <!-- Only a comment here -->
        </div>
      `)
    })

    test("span with only a comment becomes inline (acceptable for inline elements)", () => {
      const source = dedent`
        <span>
          <!-- Even in inline elements -->
        </span>
      `
      const result = formatter.format(source)
      expect(result).toEqual(dedent`
        <span><!-- Even in inline elements --></span>
      `)
    })
  })
})
