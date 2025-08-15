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

  test("formats simple HTML with ERB content", () => {
    const source = '<div><%= "Hello" %> World</div>'
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div><%= "Hello" %> World</div>
    `)
  })

  test("formats standalone ERB", () => {
    const source = '<% title %>'
    const result = formatter.format(source)
    expect(result).toEqual(`<% title %>`)
  })

  test("formats nested blocks with final example", () => {
    const source = `
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %><span>OK</span><% else %><span>NO</span><% end %>
        <% end %>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %>
            <span>OK</span>
          <% else %>
            <span>NO</span>
          <% end %>
        <% end %>
      </div>
    `)
  })

  test("preserves ERB within HTML attributes and content", () => {
    const source = dedent`
      <div>
        <h1 class="<%= classes %>">
          <%= title %>
        </h1>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <h1 class="<%= classes %>">
          <%= title %>
        </h1>
      </div>
    `)
  })

  test("should not add extra % to ERB closing tags with quoted strings", () => {
    const input = dedent`
      <div>
        <%= link_to "Nederlands", url_for(locale: 'nl'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
        <%= link_to "Français", url_for(locale: 'fr'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
        <%= link_to "English", url_for(locale: 'en'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(input)
  })

  test("should handle complex ERB in layout files", () => {
    const input = dedent`
      <div class="container flex px-5 mx-auto mt-6">
        <% if notice.present? %>
          <div class="block">
            <p class="inline-block px-5 py-2 mb-5 font-medium text-green-500 rounded bg-green-50" id="notice"><%= notice %></p>
          </div>
        <% end %>
      </div>
    `

    const result = formatter.format(input)

    expect(result).not.toContain("% %>")
    expect(result).toContain("<% if notice.present? %>")
    expect(result).toContain("<% end %>")
    expect(result).toContain("<%= notice %>")
  })

  test("handles ERB tags ending with various patterns", () => {
    const inputs = [
      '<%= link_to "test" %>',
      '<%= link_to "test", class: "btn" %>',
      '<%= render "partial" %>',
      '<% if something? %>',
      '<%= tag.div("content") %>'
    ]

    inputs.forEach(input => {
      const result = formatter.format(input)
      expect(result).not.toContain("% %>")
      expect(result).toBe(input)
    })
  })

  test("preserves ERB content with HTML entities when line wrapping occurs", () => {
    const input = dedent`
      <h3>
        <%= link_to "Start", start_path %>&rsquo;s overview of <%= link_to "Section", section_path %>, <%= link_to "End", end_path %>.
      </h3>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <h3>
        <%= link_to "Start", start_path %>&rsquo;s overview of
        <%= link_to "Section", section_path %>, <%= link_to "End", end_path %>.
      </h3>
    `)
  })

  test("preserves complex ERB expressions when exceeding line length", () => {
    const input = dedent`
      <p class="info-text">
        For assistance, contact us at <%= config.phone_number %> or <%= mail_to(config.support_email, class: "email-link") %> if you need help with your account.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p class="info-text">
        For assistance, contact us at <%= config.phone_number %> or
        <%= mail_to(config.support_email, class: "email-link") %> if you need help
        with your account.
      </p>
    `)
  })

  test("handles inline HTML elements with long text content", () => {
    const input = dedent`
      <p>
        Visit <a href="/products">our amazing product catalog with hundreds of items</a> or <a href="/support">contact our customer support team</a> for assistance with your order.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        Visit
        <a href="/products">our amazing product catalog with hundreds of items</a> or
        <a href="/support">contact our customer support team</a> for assistance with
        your order.
      </p>
    `)
  })

  test("handles multiple inline elements with adjacent text", () => {
    const input = dedent`
      <div>
        Call us at <strong>555-123-4567</strong>, email <a href="mailto:help@example.com">help@example.com</a>, or visit <em>our downtown office</em> during business hours.
      </div>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <div>
        Call us at <strong>555-123-4567</strong>, email
        <a href="mailto:help@example.com">help@example.com</a>, or visit
        <em>our downtown office</em> during business hours.
      </div>
    `)
  })

  test("handles inline elements with punctuation attachment", () => {
    const input = dedent`
      <p>
        Read the <a href="/terms">terms and conditions</a>, review our <a href="/privacy">privacy policy</a>, and check the <a href="/faq">frequently asked questions</a>.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        Read the <a href="/terms">terms and conditions</a>, review our
        <a href="/privacy">privacy policy</a>, and check the
        <a href="/faq">frequently asked questions</a>.
      </p>
    `)
  })

  test("handles nested inline elements with line wrapping", () => {
    const input = dedent`
      <p>
        Please review <strong>Chapter <em>3: Advanced Techniques</em> in the <a href="/manual">user manual</a></strong> for detailed instructions on configuration.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        Please review
        <strong>Chapter <em>3: Advanced Techniques</em> in the <a href="/manual">user manual</a></strong>
        for detailed instructions on configuration.
      </p>
    `)
  })

  test("handles inline elements immediately followed by punctuation", () => {
    const input = dedent`
      <div>
        Download the <a href="/app.zip">latest version</a>; install it quickly; then restart your <strong>computer</strong>!
      </div>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <div>
        Download the
        <a href="/app.zip">latest version</a>; install it quickly; then restart your
        <strong>computer</strong>!
      </div>
    `)
  })

  test("handles mixed content with inline elements and long URLs", () => {
    const input = dedent`
      <p>
        For more information, visit <a href="https://example.com/very/long/path/to/documentation/page">our comprehensive documentation</a> or contact support.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        For more information, visit
        <a href="https://example.com/very/long/path/to/documentation/page">our comprehensive documentation</a>
        or contact support.
      </p>
    `)
  })

  test("handles anchor tags with content that forces line breaks", () => {
    const input = dedent`
      <p>
        For more information, visit <a href="https://example.com/very/long/path/to/documentation/page/so/long/that/it/should/break/the/content/of/the/tag">our comprehensive documentation</a> or contact support.
      </p>
    `

    const result = formatter.format(input)

    expect(result).toBe(dedent`
      <p>
        For more information, visit
        <a href="https://example.com/very/long/path/to/documentation/page/so/long/that/it/should/break/the/content/of/the/tag">our comprehensive documentation</a>
        or contact support.
      </p>
    `)
  })
})
