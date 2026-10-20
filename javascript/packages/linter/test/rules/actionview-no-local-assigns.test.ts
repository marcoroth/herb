import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewNoLocalAssignsRule } from "../../src/rules/actionview-no-local-assigns.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewNoLocalAssignsRule)

const keyedMessage = (name: string) =>
  `Declare \`${name}\` in a \`<%# locals: (...) %>\` declaration and read it by name instead of through \`local_assigns\`. A declaration documents which locals the template takes, and Rails raises when a caller passes one it does not list.`

const bareMessage =
  "Declare the template's locals in a `<%# locals: (...) %>` declaration and read them by name instead of through `local_assigns`. A declaration documents which locals the template takes, and Rails raises when a caller passes one it does not list."

describe("actionview-no-local-assigns", () => {
  test("passes for a template without local_assigns", () => {
    expectNoOffenses(`<h1><%= title %></h1>`, { fileName: "_card.html.erb" })
  })

  test("passes for a template with a strict locals declaration", () => {
    expectNoOffenses(dedent`
      <%# locals: (title:, size: nil) %>

      <h1><%= title %></h1>
      <% if local_assigns.key?(:size) %>
        <span><%= size %></span>
      <% end %>
    `, { fileName: "_card.html.erb" })
  })

  test("passes for a template with an empty strict locals declaration", () => {
    expectNoOffenses(dedent`
      <%# locals: () %>

      <%= local_assigns.inspect %>
    `, { fileName: "_card.html.erb" })
  })

  test("passes for a local variable named local_assigns", () => {
    expectNoOffenses(dedent`
      <% local_assigns = { title: "Hello" } %>
      <%= local_assigns[:title] %>
    `, { fileName: "_card.html.erb" })
  })

  test("passes for local_assigns called on a receiver", () => {
    expectNoOffenses(`<%= presenter.local_assigns[:title] %>`, { fileName: "_card.html.erb" })
  })

  test("passes for local_assigns inside an ERB comment", () => {
    expectNoOffenses(`<%# local_assigns[:title] %>`, { fileName: "_card.html.erb" })
  })

  test("passes for local_assigns inside a String", () => {
    expectNoOffenses(`<%= "local_assigns[:title]" %>`, { fileName: "_card.html.erb" })
  })

  test("fails for a lookup with a Symbol key", () => {
    expectInfo(keyedMessage("title"), [1, 4])

    assertOffenses(`<%= local_assigns[:title] %>`, { fileName: "_card.html.erb" })
  })

  test("fails for every lookup method with a Symbol key", () => {
    expectInfo(keyedMessage("alerts"))
    expectInfo(keyedMessage("user"))
    expectInfo(keyedMessage("size"))
    expectInfo(keyedMessage("admin"))
    expectInfo(keyedMessage("footer"))
    expectInfo(keyedMessage("header"))

    assertOffenses(dedent`
      <% local_assigns.fetch(:alerts, []).each do |alert| %>
        <p><%= alert %></p>
      <% end %>
      <%= local_assigns.dig(:user, :name) %>
      <% if local_assigns.key?(:size) %><span></span><% end %>
      <% if local_assigns.has_key?(:admin) %><span></span><% end %>
      <% if local_assigns.include?(:footer) %><span></span><% end %>
      <% if local_assigns.member?(:header) %><span></span><% end %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails for a lookup with a dynamic key", () => {
    expectInfo(bareMessage, [1, 4])

    assertOffenses(`<%= local_assigns[key] %>`, { fileName: "_card.html.erb" })
  })

  test("fails for a lookup with a String key", () => {
    expectInfo(bareMessage)

    assertOffenses(`<%= local_assigns["title"] %>`, { fileName: "_card.html.erb" })
  })

  test("fails for forwarding local_assigns to another partial", () => {
    expectInfo(bareMessage, [1, 20])

    assertOffenses(`<%= render "row", **local_assigns %>`, { fileName: "_card.html.erb" })
  })

  test("fails for pattern matching on local_assigns", () => {
    expectInfo(bareMessage)

    assertOffenses(dedent`
      <% local_assigns => { headline: } %>
      <h1><%= headline %></h1>
    `, { fileName: "_card.html.erb" })
  })

  test("fails for iterating over local_assigns", () => {
    expectInfo(bareMessage)

    assertOffenses(dedent`
      <% local_assigns.each do |name, value| %>
        <dt><%= name %></dt><dd><%= value %></dd>
      <% end %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails once per read", () => {
    expectInfo(keyedMessage("title"), [1, 4])
    expectInfo(keyedMessage("title"), [2, 4])
    expectInfo(bareMessage, [3, 4])

    assertOffenses(dedent`
      <%= local_assigns[:title] %>
      <%= local_assigns[:title] %>
      <%= local_assigns.size %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails in templates that are not partials", () => {
    expectInfo(keyedMessage("title"))

    assertOffenses(`<%= local_assigns[:title] %>`, { fileName: "app/views/posts/show.html.erb" })
  })

  test("fails in layouts", () => {
    expectInfo(keyedMessage("title"))

    assertOffenses(`<title><%= local_assigns[:title] %></title>`, { fileName: "app/views/layouts/application.html.erb" })
  })

  test("fails for a declaration written as a plain ERB comment", () => {
    expectInfo(keyedMessage("title"))

    assertOffenses(dedent`
      <% # locals: (title:) %>
      <%= local_assigns[:title] %>
    `, { fileName: "_card.html.erb" })
  })
})
