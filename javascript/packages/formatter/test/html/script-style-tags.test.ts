import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter - script and style tags", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves style tag content", () => {
    const source = dedent`
      <style>
        body {
          background: white;
          color: black;
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        body {
          background: white;
          color: black;
        }
      </style>
    `)
  })

  test("preserves script tag content", () => {
    const source = dedent`
      <script>
        function hello() {
          console.log("Hello World");
        }
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        function hello() {
          console.log("Hello World");
        }
      </script>
    `)
  })

  test("preserves inline style tag", () => {
    const source = `<style>body { margin: 0; }</style>`
    const result = formatter.format(source)
    expect(result).toEqual(`<style>body { margin: 0; }</style>`)
  })

  test("preserves inline script tag", () => {
    const source = `<script>console.log("test");</script>`
    const result = formatter.format(source)
    expect(result).toEqual(`<script>console.log("test");</script>`)
  })

  test("preserves style tag with media queries", () => {
    const source = dedent`
      <style>
        @media (max-width: 768px) {
          .nav > ul > li {
            display: block;
          }
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        @media (max-width: 768px) {
          .nav > ul > li {
            display: block;
          }
        }
      </style>
    `)
  })

  test("preserves script tag with complex JavaScript", () => {
    const source = dedent`
      <script>
        if (x < 10 && y > 5) {
          const template = \`<div>\${content}</div>\`;
          document.body.innerHTML = template;
        }
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        if (x < 10 && y > 5) {
          const template = \`<div>\${content}</div>\`;
          document.body.innerHTML = template;
        }
      </script>
    `)
  })

  test("preserves empty style tag", () => {
    const source = `<style></style>`
    const result = formatter.format(source)
    expect(result).toEqual(`<style></style>`)
  })

  test("preserves empty script tag", () => {
    const source = `<script></script>`
    const result = formatter.format(source)
    expect(result).toEqual(`<script></script>`)
  })

  test("preserves style tag with ERB interpolation", () => {
    const source = dedent`
      <style>
        .user-<%= @user.id %> {
          color: <%= @theme_color %>;
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        .user-<%= @user.id %> {
          color: <%= @theme_color %>;
        }
      </style>
    `)
  })

  test("preserves script tag with ERB interpolation", () => {
    const source = dedent`
      <script>
        var userId = <%= @user.id %>;
        var userName = "<%= @user.name %>";
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        var userId = <%= @user.id %>;
        var userName = "<%= @user.name %>";
      </script>
    `)
  })

  test("preserves multiple script and style tags", () => {
    const source = dedent`
      <style>
        .header { color: blue; }
      </style>
      <script>
        console.log("First script");
      </script>
      <style>
        .footer { color: red; }
      </style>
      <script>
        console.log("Second script");
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        .header { color: blue; }
      </style>

      <script>
        console.log("First script");
      </script>

      <style>
        .footer { color: red; }
      </style>

      <script>
        console.log("Second script");
      </script>
    `)
  })

  test("preserves script tag with closing tag in string", () => {
    const source = dedent`
      <script>
        var html = "</script>";
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        var html = "</script>";
      </script>
    `)
  })

  test("preserves style tag with CSS custom properties", () => {
    const source = dedent`
      <style>
        :root {
          --primary-color: #333;
          --secondary-color: #666;
        }
        .element {
          color: var(--primary-color);
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        :root {
          --primary-color: #333;
          --secondary-color: #666;
        }
        .element {
          color: var(--primary-color);
        }
      </style>
    `)
  })

  test("preserves script tag with type module attribute", () => {
    const source = dedent`
      <script type="module">
        import { hello } from './module.js';

        export function greet(name) {
          return hello(name);
        }
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script type="module">
        import { hello } from './module.js';

        export function greet(name) {
          return hello(name);
        }
      </script>
    `)
  })

  test("preserves script tag with multiple attributes", () => {
    const source = dedent`
      <script src="app.js" defer type="text/javascript" id="main-script">
        console.log("Fallback script");
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script
        src="app.js"
        defer
        type="text/javascript"
        id="main-script"
      >
        console.log("Fallback script");
      </script>
    `)
  })

  test("preserves style tag with media attribute", () => {
    const source = dedent`
      <style media="screen and (min-width: 900px)">
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style media="screen and (min-width: 900px)">
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
      </style>
    `)
  })

  test("preserves style tag with type and id attributes", () => {
    const source = dedent`
      <style type="text/css" id="critical-css">
        body {
          font-family: system-ui, sans-serif;
        }
        .header {
          position: fixed;
          top: 0;
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style type="text/css" id="critical-css">
        body {
          font-family: system-ui, sans-serif;
        }
        .header {
          position: fixed;
          top: 0;
        }
      </style>
    `)
  })

  test("preserves inline script with attributes", () => {
    const source = `<script type="application/json" id="config">{"api": "https://example.com"}</script>`
    const result = formatter.format(source)

    expect(result).toEqual(`<script type="application/json" id="config">{"api": "https://example.com"}</script>`)
  })

  test("preserves inline style with attributes", () => {
    const source = `<style type="text/css" data-theme="dark">.dark { background: #000; }</style>`
    const result = formatter.format(source)

    expect(result).toEqual(`<style type="text/css" data-theme="dark">.dark { background: #000; }</style>`)
  })

  test("preserves script tag with async attribute", () => {
    const source = dedent`
      <script async src="analytics.js">
        // Fallback code
        window.analytics = window.analytics || [];
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script async src="analytics.js">
        // Fallback code
        window.analytics = window.analytics || [];
      </script>
    `)
  })

  test("preserves style tag with scoped attribute and nonce", () => {
    const source = dedent`
      <style scoped nonce="<%= csp_nonce %>">
        :scope {
          display: block;
          padding: 1rem;
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style scoped nonce="<%= csp_nonce %>">
        :scope {
          display: block;
          padding: 1rem;
        }
      </style>
    `)
  })

  test("preserves script tag with crossorigin and integrity attributes", () => {
    const source = dedent`
      <script crossorigin="anonymous" integrity="sha384-abc123" src="https://cdn.example.com/lib.js">
        console.error("CDN failed to load");
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script
        crossorigin="anonymous"
        integrity="sha384-abc123"
        src="https://cdn.example.com/lib.js"
      >
        console.error("CDN failed to load");
      </script>
    `)
  })

  test.skip("handles indendentation for script tags", () => {
    const source = dedent`
      <script>
      console.error("CDN failed to load");
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        console.error("CDN failed to load");
      </script>
    `)
  })

  test.skip("handles indendentation for style tags", () => {
    const source = dedent`
      <style>
      :scope {
        display: block;
        padding: 1rem;
      }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        :scope {
          display: block;
          padding: 1rem;
        }
      </style>
    `)
  })

  test.skip("normalizes excessive indentation in style tags", () => {
    const source = dedent`
      <style>
          :scope {
            display: block;
            padding: 1rem;
          }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        :scope {
          display: block;
          padding: 1rem;
        }
      </style>
    `)
  })

  test.skip("preserves relative indentation for inconsistently indented style content", () => {
    const source = dedent`
      <style>
        :scope {
            display: block;
          padding: 1rem;
          }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        :scope {
            display: block;
          padding: 1rem;
          }
      </style>
    `)
  })

  test("preserves ERB interpolation within script tag content", () => {
    const source = dedent`
      <script>
        var apiUrl = "<%= Rails.application.routes.url_helpers.api_path %>";
        var userId = <%= current_user.id %>;

        if (userId) {
          fetch(apiUrl + '/users/' + userId)
            .then(response => response.json())
            .then(data => console.log(data));
        }
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        var apiUrl = "<%= Rails.application.routes.url_helpers.api_path %>";
        var userId = <%= current_user.id %>;

        if (userId) {
          fetch(apiUrl + '/users/' + userId)
            .then(response => response.json())
            .then(data => console.log(data));
        }
      </script>
    `)
  })

  test("preserves ERB interpolation within style tag content", () => {
    const source = dedent`
      <style>
        .brand-color {
          color: <%= @theme.primary_color %>;
        }

        .user-avatar-<%= current_user.id %> {
          background-image: url('<%= asset_path(@user.avatar) %>');
          width: <%= @avatar_size %>px;
          height: <%= @avatar_size %>px;
        }

        @media (max-width: <%= @breakpoint_mobile %>px) {
          .responsive-text {
            font-size: <%= @mobile_font_size %>rem;
          }
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        .brand-color {
          color: <%= @theme.primary_color %>;
        }

        .user-avatar-<%= current_user.id %> {
          background-image: url('<%= asset_path(@user.avatar) %>');
          width: <%= @avatar_size %>px;
          height: <%= @avatar_size %>px;
        }

        @media (max-width: <%= @breakpoint_mobile %>px) {
          .responsive-text {
            font-size: <%= @mobile_font_size %>rem;
          }
        }
      </style>
    `)
  })

  test("preserves ERB conditional logic within script tags", () => {
    const source = dedent`
      <script>
        <% if Rails.env.development? %>
          console.log("Development mode");
          var debugMode = true;
        <% else %>
          var debugMode = false;
        <% end %>

        var config = {
          debug: debugMode,
          apiEndpoint: "<%= @api_endpoint %>",
          <% if feature_enabled?(:analytics) %>
          trackingId: "<%= @analytics_id %>",
          <% end %>
        };
      </script>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script>
        <% if Rails.env.development? %>
          console.log("Development mode");
          var debugMode = true;
        <% else %>
          var debugMode = false;
        <% end %>

        var config = {
          debug: debugMode,
          apiEndpoint: "<%= @api_endpoint %>",
          <% if feature_enabled?(:analytics) %>
          trackingId: "<%= @analytics_id %>",
          <% end %>
        };
      </script>
    `)
  })

  test("preserves complex ERB loop within style tags", () => {
    const source = dedent`
      <style>
        <% @color_variants.each_with_index do |color, index| %>
          .color-variant-<%= index %> {
            background-color: <%= color.hex %>;
            color: <%= color.contrast_color %>;
          }

          .color-variant-<%= index %>:hover {
            background-color: <%= color.darken(10).hex %>;
          }
        <% end %>

        <% if @theme.has_gradients? %>
          .gradient-bg {
            background: linear-gradient(
              45deg,
              <%= @theme.primary_color %>,
              <%= @theme.secondary_color %>
            );
          }
        <% end %>
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <style>
        <% @color_variants.each_with_index do |color, index| %>
          .color-variant-<%= index %> {
            background-color: <%= color.hex %>;
            color: <%= color.contrast_color %>;
          }

          .color-variant-<%= index %>:hover {
            background-color: <%= color.darken(10).hex %>;
          }
        <% end %>

        <% if @theme.has_gradients? %>
          .gradient-bg {
            background: linear-gradient(
              45deg,
              <%= @theme.primary_color %>,
              <%= @theme.secondary_color %>
            );
          }
        <% end %>
      </style>
    `)
  })

  test("preserves inline ERB in script and style attributes", () => {
    const source = dedent`
      <script type="<%= @script_type %>" data-config='{"theme": "<%= @theme.name %>"}'>
        var userPrefs = <%= @user_preferences.to_json.html_safe %>;
      </script>

      <style media="<%= @media_query %>" data-theme="<%= @current_theme %>">
        body {
          font-family: '<%= @font_family %>', sans-serif;
        }
      </style>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <script
        type="<%= @script_type %>"
        data-config='{"theme": "<%= @theme.name %>"}'
      >
        var userPrefs = <%= @user_preferences.to_json.html_safe %>;
      </script>

      <style media="<%= @media_query %>" data-theme="<%= @current_theme %>">
        body {
          font-family: '<%= @font_family %>', sans-serif;
        }
      </style>
    `)
  })
})
