import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBSafetyRule } from "../../src/rules/erb-safety.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBSafetyRule)

describe("ERBSafetyRule", () => {
  describe("attribute position safety", () => {
    test("valid static attributes", () => {
      expectNoOffenses(dedent`
        <div class="container" id="main"></div>
        <img src="/logo.png" alt="Logo">
        <input type="text" name="field">
      `)
    })

    test("valid ERB output in attribute values", () => {
      expectNoOffenses(dedent`
        <div class="<%= css_class %>"></div>
        <input value="<%= user.name %>">
        <a href="<%= path %>">Link</a>
      `)
    })

    test("valid ERB control flow in attribute position", () => {
      expectNoOffenses(dedent`
        <div <% if active? %>class="active"<% end %>></div>
        <input <% unless disabled %>enabled<% end %>>
      `)
    })

    test("invalid ERB output tag in attribute position", () => {
      expectError("ERB output tags (`<%= %>`) are not allowed in attribute position. Use control flow (`<% %>`) with static attributes instead.")

      assertOffenses(dedent`
        <div <%= data_attributes %>></div>
      `)
    })

    test("invalid ERB raw output tag in attribute position", () => {
      expectError("ERB output tags (`<%= %>`) are not allowed in attribute position. Use control flow (`<% %>`) with static attributes instead.")

      assertOffenses(dedent`
        <div <%== raw_attributes %>></div>
      `)
    })

    test("multiple ERB output tags in attribute position", () => {
      expectError("ERB output tags (`<%= %>`) are not allowed in attribute position. Use control flow (`<% %>`) with static attributes instead.")
      expectError("ERB output tags (`<%= %>`) are not allowed in attribute position. Use control flow (`<% %>`) with static attributes instead.")

      assertOffenses(dedent`
        <div <%= first_attrs %> <%= second_attrs %>></div>
      `)
    })

    test("mixed valid attributes and invalid ERB output in attribute position", () => {
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")

      assertOffenses(dedent`
        <div class="container" <%= extra_attrs %> id="main"></div>
      `)
    })
  })

  describe("attribute name safety", () => {
    test("valid static attribute names", () => {
      expectNoOffenses(dedent`
        <div class="container"></div>
        <input type="text" data-target="value">
      `)
    })

    test("invalid ERB output in attribute name", () => {
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")

      assertOffenses(dedent`
        <div data-<%= key %>="value"></div>
      `)
    })

    test("multiple ERB outputs in attribute names across elements", () => {
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")

      assertOffenses(dedent`
        <div data-<%= key1 %>="value1"></div>
        <span data-<%= key2 %>="value2"></span>
      `)
    })

    test("ERB silent tag in attribute name is allowed", () => {
      expectNoOffenses(dedent`
        <div data-<% key %>-target="value"></div>
      `)
    })
  })

  describe("combined checks", () => {
    test("both attribute position and attribute name violations", () => {
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")

      assertOffenses(dedent`
        <div <%= attrs %> data-<%= key %>="value"></div>
      `)
    })

    test("nested elements with violations", () => {
      expectError("ERB output tags (`<%= %>`) are not allowed in attribute position. Use control flow (`<% %>`) with static attributes instead.")
      expectError("ERB output in attribute names is not allowed for security reasons. Use static attribute names with dynamic values instead.")

      assertOffenses(dedent`
        <form>
          <div <%= attrs %>></div>
          <input data-<%= key %>="value">
        </form>
      `)
    })
  })

  describe("raw() and .html_safe in ERB output", () => {
    test.fails("raw() in attribute value is not allowed", () => {
      expectError("erb interpolation with '<%= raw(...) %>' in this context is never safe")

      assertOffenses(dedent`
        <div class="<%= raw(user_input) %>"></div>
      `)
    })

    test.fails("raw() in non-JS attribute is not allowed", () => {
      expectError("erb interpolation with '<%= raw(...) %>' in this context is never safe")

      assertOffenses(dedent`
        <a href="<%= raw unsafe %>">Link</a>
      `)
    })

    test.fails("html_safe in attribute value is not allowed", () => {
      expectError("erb interpolation with '<%= (...).html_safe %>' in this context is never safe")

      assertOffenses(dedent`
        <div class="<%= user_input.html_safe %>"></div>
      `)
    })

    test.fails("html_safe in non-JS attribute is not allowed", () => {
      expectError("erb interpolation with '<%= (...).html_safe %>' in this context is never safe")

      assertOffenses(dedent`
        <a href="<%= unsafe.html_safe %>">Link</a>
      `)
    })

    test.fails("html_safe with to_json in JS attribute is still not allowed", () => {
      expectError("erb interpolation with '<%= (...).html_safe %>' in this context is never safe")
      expectError("erb interpolation in javascript attribute must be wrapped in safe helper such as '(...).to_json'")

      assertOffenses(dedent`
        <a onclick="method(<%= unsafe.to_json.html_safe %>)"></a>
      `)
    })

    test.fails("raw() in text content is not allowed", () => {
      expectError("erb interpolation with '<%= raw(...) %>' in this context is never safe")

      assertOffenses(dedent`
        <p><%= raw(user_input) %></p>
      `)
    })

    test.fails("html_safe in text content is not allowed", () => {
      expectError("erb interpolation with '<%= (...).html_safe %>' in this context is never safe")

      assertOffenses(dedent`
        <p><%= user_input.html_safe %></p>
      `)
    })

    test.fails("raw() in helper call is not allowed", () => {
      expectError("erb interpolation with '<%= raw(...) %>' in this context is never safe")

      assertOffenses(dedent`
        <%= ui_my_helper(:foo, help_text: raw("foo")) %>
      `)
    })
  })

  describe("<%== %> in attribute values", () => {
    test.fails("raw output tag in attribute value is not allowed", () => {
      expectError("erb interpolation with '<%==' inside html attribute is never safe")

      assertOffenses(dedent`
        <div class="<%== user_input %>"></div>
      `)
    })

    test.fails("raw output tag in non-JS attribute is not allowed", () => {
      expectError("erb interpolation with '<%==' inside html attribute is never safe")

      assertOffenses(dedent`
        <a href="<%== unsafe %>">Link</a>
      `)
    })

    test.fails("raw output tag even with to_json in JS attribute is not allowed", () => {
      expectError("erb interpolation with '<%==' inside html attribute is never safe")

      assertOffenses(dedent`
        <a onclick="method(<%== unsafe.to_json %>)"></a>
      `)
    })

    test.fails("raw output tag in multiple attribute values", () => {
      expectError("erb interpolation with '<%==' inside html attribute is never safe")
      expectError("erb interpolation with '<%==' inside html attribute is never safe")

      assertOffenses(dedent`
        <div class="<%== class_name %>" id="<%== element_id %>"></div>
      `)
    })
  })

  describe("ERB output in JavaScript attributes", () => {
    test.fails("ERB output in onclick without .to_json is not allowed", () => {
      expectError("erb interpolation in javascript attribute must be wrapped in safe helper such as '(...).to_json'")

      assertOffenses(dedent`
        <a onclick="method(<%= unsafe %>)"></a>
      `)
    })

    test.fails("ERB output in onmouseover without .to_json is not allowed", () => {
      expectError("erb interpolation in javascript attribute must be wrapped in safe helper such as '(...).to_json'")

      assertOffenses(dedent`
        <div onmouseover="highlight('<%= element_id %>')"></div>
      `)
    })

    test("static string in JS attribute is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="alert('<%= "something" %>')"></a>
      `)
    })

    test("ERB output in onclick with .to_json is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= unsafe.to_json %>)"></a>
      `)
    })

    test("j() is safe in JS attribute", () => {
      expectNoOffenses(dedent`
        <a onclick="method('<%= j(unsafe) %>')"></a>
      `)
    })

    test("escape_javascript() is safe in JS attribute", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= escape_javascript(unsafe) %>)"></a>
      `)
    })

    test("ternary with safe JS escaping is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= foo ? bar.to_json : j(baz) %>)"></a>
      `)
    })

    test.fails("ternary with unsafe JS escaping is not allowed", () => {
      expectError("erb interpolation in javascript attribute must be wrapped in safe helper such as '(...).to_json'")

      assertOffenses(dedent`
        <a onclick="method(<%= foo ? bar : j(baz) %>)"></a>
      `)
    })
  })

  describe("ERB output inside script tags", () => {
    test.fails("ERB output in script tag without .to_json is not allowed", () => {
      expectError("erb interpolation in javascript tag must call '(...).to_json'")

      assertOffenses(dedent`
        <script>
          if (a < 1) { <%= unsafe %> }
        </script>
      `)
    })

    test.fails("ERB output in script tag with type text/javascript is not allowed", () => {
      expectError("erb interpolation in javascript tag must call '(...).to_json'")

      assertOffenses(dedent`
        <script type="text/javascript">
          if (a < 1) { <%= unsafe %> }
        </script>
      `)
    })

    test.fails("string literal in script tag without method call is not allowed", () => {
      expectError("erb interpolation in javascript tag must call '(...).to_json'")

      assertOffenses(dedent`
        <script type="text/javascript">
          if (a < 1) { <%= "unsafe" %> }
        </script>
      `)
    })

    test("ERB output in script tag with .to_json is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          <%= unsafe.to_json %>
        </script>
      `)
    })

    test("raw with to_json in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          <%= raw unsafe.to_json %>
        </script>
      `)
    })

    test.fails("html_safe without to_json in script tag is not allowed", () => {
      expectError("erb interpolation in javascript tag must call '(...).to_json'")

      assertOffenses(dedent`
        <script><%= @feature.html_safe %></script>
      `)
    })
  })

  describe("ERB silent tags inside script tags", () => {
    test.fails("ERB silent tag in script tag is not allowed", () => {
      expectError("erb statement not allowed here; did you mean '<%=' ?")

      assertOffenses(dedent`
        <script type="text/javascript">
          <% if foo? %>
            bla
          <% end %>
        </script>
      `)
    })

    test.fails("ERB silent tag in script without specified type is not allowed", () => {
      expectError("erb statement not allowed here; did you mean '<%=' ?")
      assertOffenses(dedent`
        <script>
          <% if foo? %>
            bla
          <% end %>
        </script>
      `)
    })

    test("ERB end statement in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/template">
          <%= ui_form do %>
            <div></div>
          <% end %>
        </script>
      `)
    })

    test("ERB comments in script tags are allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          <%# comment %>
        </script>
      `)
    })

    test("ERB silent tag in script type text/html is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/html">
          <% if condition %>
            <p>Content</p>
          <% end %>
        </script>
      `)
    })

    test("statement after script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          foo()
        </script>
        <% if condition? %>
        <% end %>
      `)
    })
  })

  describe("javascript_tag helper", () => {
    test.fails("javascript_tag helper is not allowed", () => {
      expectError("'javascript_tag do' syntax is deprecated; use inline <script> instead")

      assertOffenses(dedent`
        <%= javascript_tag do %>
          if (a < 1) { <%= unsafe %> }
        <% end %>
      `)
    })
  })
})
