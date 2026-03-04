import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter - content preserving tags", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves pre tag content with whitespace", () => {
    const source = dedent`
      <pre>
        function hello() {
          console.log("Hello World");
        }
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
        function hello() {
          console.log("Hello World");
        }
      </pre>
    `)
  })

  test("preserves textarea content with whitespace", () => {
    const source = dedent`
      <textarea>
        This is some text
          with custom indentation
            and spacing
      </textarea>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <textarea>
        This is some text
          with custom indentation
            and spacing
      </textarea>
    `)
  })

  test("preserves inline pre tag content", () => {
    const source = `<pre>code with    spaces</pre>`
    const result = formatter.format(source)
    expect(result).toEqual(`<pre>code with    spaces</pre>`)
  })

  test("preserves inline textarea content", () => {
    const source = `<textarea>text   with   spaces</textarea>`
    const result = formatter.format(source)
    expect(result).toEqual(`<textarea>text   with   spaces</textarea>`)
  })

  test("preserves pre tag with ERB interpolation", () => {
    const source = dedent`
      <pre>
        User: <%= @user.name %>
          ID: <%= @user.id %>
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
        User: <%= @user.name %>
          ID: <%= @user.id %>
      </pre>
    `)
  })

  test("preserves textarea with ERB interpolation", () => {
    const source = dedent`
      <textarea>
        Dear <%= @user.name %>,

        Thank you for your interest.

        Best regards,
        <%= @sender %>
      </textarea>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <textarea>
        Dear <%= @user.name %>,

        Thank you for your interest.

        Best regards,
        <%= @sender %>
      </textarea>
    `)
  })

  test("preserves pre tag with attributes", () => {
    const source = dedent`
      <pre class="code-block" data-language="javascript">
        const x = 10;
          const y = 20;
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre class="code-block" data-language="javascript">
        const x = 10;
          const y = 20;
      </pre>
    `)
  })

  test("preserves textarea with attributes", () => {
    const source = dedent`
      <textarea rows="5" cols="30" placeholder="Enter text">
        Default content
          with spacing
      </textarea>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <textarea rows="5" cols="30" placeholder="Enter text">
        Default content
          with spacing
      </textarea>
    `)
  })

  test("preserves empty pre tag", () => {
    const source = `<pre></pre>`
    const result = formatter.format(source)
    expect(result).toEqual(`<pre></pre>`)
  })

  test("preserves empty textarea tag", () => {
    const source = `<textarea></textarea>`
    const result = formatter.format(source)
    expect(result).toEqual(`<textarea></textarea>`)
  })

  test("preserves pre tag with special characters", () => {
    const source = dedent`
      <pre>
        <script>
          if (x < 10 && y > 5) {
            console.log("Special chars: & < > \" '");
          }
        </script>
      </pre>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <pre>
        <script>
          if (x < 10 && y > 5) {
            console.log("Special chars: & < > \" '");
          }
        </script>
      </pre>
    `)
  })

  test("preserves textarea with ERB control flow", () => {
    const source = dedent`
      <textarea>
        <% if @user.admin? %>
          Admin instructions:
            - Manage users
            - Configure settings
        <% else %>
          User instructions:
            - Update profile
        <% end %>
      </textarea>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <textarea>
        <% if @user.admin? %>
          Admin instructions:
            - Manage users
            - Configure settings
        <% else %>
          User instructions:
            - Update profile
        <% end %>
      </textarea>
    `)
  })
})
