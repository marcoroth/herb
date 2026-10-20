import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewNoLocalAssignsRule } from "../../src/rules/actionview-no-local-assigns.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewNoLocalAssignsRule)

const DECLARATION = "`<%# locals: (...) %>` declaration at the top of the template"

const readMessage = (code: string, declared: string, replacement: string) =>
  `\`${code}\` reads a local the template does not declare. Declare \`${declared}\` in a ${DECLARATION} and read \`${replacement}\` instead.`

const presenceMessage = (code: string, name: string) =>
  `\`${code}\` checks for a local the template does not declare. Declare \`${name}: nil\` in a ${DECLARATION}, and keep the check only if it needs to tell an omitted \`${name}\` from one passed as \`nil\`.`

const declaredPresenceMessage = (code: string, name: string) =>
  `\`${code}\` checks whether a caller passed strict local \`${name}\`, which the declaration cannot express. Check \`${name}\` itself when an omitted \`${name}\` and one passed as \`nil\` can be treated the same, or keep it with a \`herb:disable\` comment if the template needs to tell them apart.`

const declaredBareMessage =
  "`local_assigns` is used next to a strict locals declaration. Read the declared locals by name, or keep it with a `herb:disable` comment where it forwards every local on purpose."

const bareMessage =
  `\`local_assigns\` is used in a template without a strict locals declaration. Declare the locals the template takes in a ${DECLARATION}, so Rails raises when a caller passes one it does not list.`

describe("actionview-no-local-assigns", () => {
  test("passes for a template without local_assigns", () => {
    expectNoOffenses(`<h1><%= title %></h1>`, { fileName: "_card.html.erb" })
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
    expectInfo(readMessage("local_assigns[:title]", "title: nil", "title"), [1, 4])

    assertOffenses(`<%= local_assigns[:title] %>`, { fileName: "_card.html.erb" })
  })

  test("fails for fetch with a default and names it in the declaration", () => {
    expectInfo(readMessage("local_assigns.fetch(:alerts, [])", "alerts: []", "alerts"))

    assertOffenses(dedent`
      <% local_assigns.fetch(:alerts, []).each do |alert| %>
        <p><%= alert %></p>
      <% end %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails for fetch without a default and declares the local as required", () => {
    expectInfo(readMessage("local_assigns.fetch(:user)", "user:", "user"))

    assertOffenses(`<%= local_assigns.fetch(:user).name %>`, { fileName: "_card.html.erb" })
  })

  test("fails for fetch with a block default without quoting the block", () => {
    expectInfo("`local_assigns.fetch(:alerts) { [] }` reads a local the template does not declare. Declare `alerts` with that default value in a `<%# locals: (...) %>` declaration at the top of the template and read `alerts` instead.")

    assertOffenses(`<%= local_assigns.fetch(:alerts) { [] } %>`, { fileName: "_card.html.erb" })
  })

  test("fails for fetch with a multi-line default without quoting it", () => {
    expectInfo("`local_assigns` reads a local the template does not declare. Declare `alerts` with that default value in a `<%# locals: (...) %>` declaration at the top of the template and read `alerts` instead.")

    assertOffenses(dedent`
      <% alerts = local_assigns.fetch(:alerts, Alert.where(
        active: true
      )) %>
      <%= alerts.size %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails for dig and keeps the remaining keys", () => {
    expectInfo(readMessage("local_assigns.dig(:user, :name)", "user: nil", "user&.dig(:name)"))
    expectInfo(readMessage("local_assigns.dig(:user)", "user: nil", "user"))

    assertOffenses(dedent`
      <%= local_assigns.dig(:user, :name) %>
      <%= local_assigns.dig(:user) %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails for presence checks without telling to read the local", () => {
    expectInfo(presenceMessage("local_assigns.key?(:size)", "size"))
    expectInfo(presenceMessage("local_assigns.has_key?(:admin)", "admin"))
    expectInfo(presenceMessage("local_assigns.include?(:footer)", "footer"))
    expectInfo(presenceMessage("local_assigns.member?(:header)", "header"))

    assertOffenses(dedent`
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
    expectInfo(readMessage("local_assigns[:title]", "title: nil", "title"), [1, 4])
    expectInfo(readMessage("local_assigns[:title]", "title: nil", "title"), [2, 4])
    expectInfo(bareMessage, [3, 4])

    assertOffenses(dedent`
      <%= local_assigns[:title] %>
      <%= local_assigns[:title] %>
      <%= local_assigns.size %>
    `, { fileName: "_card.html.erb" })
  })

  test("fails in templates that are not partials", () => {
    expectInfo(readMessage("local_assigns[:title]", "title: nil", "title"))

    assertOffenses(`<%= local_assigns[:title] %>`, { fileName: "app/views/posts/show.html.erb" })
  })

  test("fails in layouts", () => {
    expectInfo(readMessage("local_assigns[:title]", "title: nil", "title"))

    assertOffenses(`<title><%= local_assigns[:title] %></title>`, { fileName: "app/views/layouts/application.html.erb" })
  })

  test("fails for a declaration written as a plain ERB comment", () => {
    expectInfo(readMessage("local_assigns[:title]", "title: nil", "title"))

    assertOffenses(dedent`
      <% # locals: (title:) %>
      <%= local_assigns[:title] %>
    `, { fileName: "_card.html.erb" })
  })

  describe("with a strict locals declaration", () => {
    test("leaves lookups of required locals to actionview-no-redundant-local-assigns", () => {
      expectNoOffenses(dedent`
        <%# locals: (title:) %>

        <h1><%= local_assigns[:title] %></h1>
        <% if local_assigns.key?(:title) %><span></span><% end %>
      `, { fileName: "_card.html.erb" })
    })

    test("leaves lookups of undeclared locals to actionview-no-redundant-local-assigns", () => {
      expectNoOffenses(dedent`
        <%# locals: (title:) %>

        <%= local_assigns[:subtitle] %>
      `, { fileName: "_card.html.erb" })
    })

    test("fails for a value lookup of an optional local", () => {
      expectInfo("`local_assigns[:size]` reads strict local `size` through `local_assigns`. Read `size` instead, which uses the declared default when a caller omits `size`.", [3, 4])

      assertOffenses(dedent`
        <%# locals: (size: nil) %>

        <%= local_assigns[:size] %>
      `, { fileName: "_card.html.erb" })
    })

    test("fails for a presence check of an optional local", () => {
      expectInfo(declaredPresenceMessage("local_assigns.key?(:size)", "size"))

      assertOffenses(dedent`
        <%# locals: (title:, size: nil) %>

        <h1><%= title %></h1>
        <% if local_assigns.key?(:size) %>
          <span><%= size %></span>
        <% end %>
      `, { fileName: "_card.html.erb" })
    })

    test("fails for a lookup of an undeclared local when the declaration has keyword rest", () => {
      expectInfo("`local_assigns[:extra]` reads a local the template does not declare. Declare `extra: nil` in the template's `locals:` declaration and read `extra` instead.")

      assertOffenses(dedent`
        <%# locals: (title:, **) %>

        <%= local_assigns[:extra] %>
      `, { fileName: "_card.html.erb" })
    })

    test("fails for forwarding local_assigns", () => {
      expectInfo(declaredBareMessage, [3, 20])

      assertOffenses(dedent`
        <%# locals: (user:, **) %>

        <%= render "row", **local_assigns %>
      `, { fileName: "_card.html.erb" })
    })

    test("fails for local_assigns next to an empty declaration", () => {
      expectInfo(declaredBareMessage)

      assertOffenses(dedent`
        <%# locals: () %>

        <%= local_assigns.inspect %>
      `, { fileName: "_card.html.erb" })
    })

    test("fails for lookups of required locals in templates that are not partials", () => {
      expectInfo("`local_assigns[:title]` reads strict local `title` through `local_assigns`. Read `title` instead.")
      expectInfo("`local_assigns.key?(:title)` checks for strict local `title`, which is required, so the check is always `true`. Remove the condition, or give `title` a default value to make it optional.")

      assertOffenses(dedent`
        <%# locals: (title:) %>

        <h1><%= local_assigns[:title] %></h1>
        <% if local_assigns.key?(:title) %><span></span><% end %>
      `, { fileName: "app/views/posts/show.html.erb" })
    })
  })
})
