import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewNoContentArgumentWithBlockRule } from "../../src/rules/actionview-no-content-argument-with-block.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoContentArgumentWithBlockRule)

describe("actionview-no-content-argument-with-block", () => {
  test("passes for `tag` with only a content argument", () => {
    expectNoOffenses(`<%= tag.div "Hello" %>`)
  })

  test("passes for `tag` with only a block", () => {
    expectNoOffenses(dedent`
      <%= tag.div do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `tag` with keyword options and a block", () => {
    expectNoOffenses(dedent`
      <%= tag.div class: "card" do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `content_tag` with only a content argument", () => {
    expectNoOffenses(`<%= content_tag :div, "Hello" %>`)
  })

  test("passes for `content_tag` with only a block", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `content_tag` with keyword options and a block", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, class: "card" do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `content_tag` with a literal options hash and a block", () => {
    expectNoOffenses(dedent`
      <%= content_tag(:div, { class: "card" }) do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `content_tag` with an options variable and a block", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, wrapper_options do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `link_to` with content and URL but no block", () => {
    expectNoOffenses(`<%= link_to "Dashboard", root_path %>`)
  })

  test("passes for `link_to` with a URL and a block", () => {
    expectNoOffenses(dedent`
      <%= link_to root_path do %>
        Dashboard
      <% end %>
    `)
  })

  test("passes for `link_to` with a URL, keyword options and a block", () => {
    expectNoOffenses(dedent`
      <%= link_to root_path, class: "nav-link" do %>
        Dashboard
      <% end %>
    `)
  })

  test("passes for `button_to` with a URL and a block", () => {
    expectNoOffenses(dedent`
      <%= button_to root_path do %>
        Delete
      <% end %>
    `)
  })

  test("passes for `mail_to` with only an address and a block", () => {
    expectNoOffenses(dedent`
      <%= mail_to "support@example.com" do %>
        Contact us
      <% end %>
    `)
  })

  test("passes for `button_tag` with only a block", () => {
    expectNoOffenses(dedent`
      <%= button_tag do %>
        Save
      <% end %>
    `)
  })

  test("passes for `button_tag` with keyword options and a block", () => {
    expectNoOffenses(dedent`
      <%= button_tag class: "primary" do %>
        Save
      <% end %>
    `)
  })

  test("passes for `label_tag` with only a name and a block", () => {
    expectNoOffenses(dedent`
      <%= label_tag :email do %>
        Email address
      <% end %>
    `)
  })

  test("passes for `field_set_tag`, whose first argument renders as a legend", () => {
    expectNoOffenses(dedent`
      <%= field_set_tag "Account" do %>
        Body
      <% end %>
    `)
  })

  test("passes for `link_to_if`, whose block only renders when the condition fails", () => {
    expectNoOffenses(dedent`
      <%= link_to_if signed_in?, "Profile", profile_path do %>
        Sign in
      <% end %>
    `)
  })

  test("passes for `truncate`, whose block is appended to the text", () => {
    expectNoOffenses(dedent`
      <%= truncate article.body, length: 100 do %>
        <%= link_to "Read more", article_path(article) %>
      <% end %>
    `)
  })

  test("passes for a form builder `label` with a receiver", () => {
    expectNoOffenses(dedent`
      <%= form.label :email, "Email" do %>
        Email address
      <% end %>
    `)
  })

  test("passes for a block argument instead of a literal block", () => {
    expectNoOffenses(`<%= content_tag :div, "Hello", &wrapper %>`)
  })

  test("passes for the call inside an ERB comment", () => {
    expectNoOffenses(dedent`
      <%# content_tag :div, "Hello" do %>
    `)
  })

  test("passes for the call inside a string", () => {
    expectNoOffenses(`<%= tag.code 'content_tag :div, "Hello" do' %>`)
  })

  test("passes for `tag.send`, whose first argument names the tag", () => {
    expectNoOffenses(dedent`
      <%= tag.send(:div, class: "card") do %>
        Hello
      <% end %>
    `)
  })

  test("passes for `tag.public_send`, whose first argument names the tag", () => {
    expectNoOffenses(dedent`
      <%= tag.public_send(element, **arguments) do %>
        Hello
      <% end %>
    `)
  })

  test("fails for `tag` with a content argument and a block", () => {
    expectError('The `tag.div` helper renders either its content argument or its block, never both, and the block wins, so `"Hello"` is silently discarded and never reaches the page. Remove `"Hello"`, or remove the block and let the argument render the content.', [1, 12])

    assertOffenses(dedent`
      <%= tag.div "Hello" do %>
        World
      <% end %>
    `)
  })

  test("fails for `tag` with a content argument, keyword options and a block", () => {
    expectError('The `tag.div` helper renders either its content argument or its block, never both, and the block wins, so `"Hello"` is silently discarded and never reaches the page. Remove `"Hello"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= tag.div "Hello", class: "card" do %>
        World
      <% end %>
    `)
  })

  test("fails for `content_tag` with a content argument and a block", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Intro"` is silently discarded and never reaches the page. Remove `"Intro"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= content_tag :section, "Intro" do %>
        Welcome
      <% end %>
    `)
  })

  test("fails for `content_tag` with a content argument, keyword options and a block", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Hello"` is silently discarded and never reaches the page. Remove `"Hello"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= content_tag :div, "Hello", class: "card" do %>
        World
      <% end %>
    `)
  })

  test("fails for a symbol content argument", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `:intro` is silently discarded and never reaches the page. Remove `:intro`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= content_tag :div, :intro do %>
        World
      <% end %>
    `)
  })

  test("fails for an interpolated content argument", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Hi #{user.name}"` is silently discarded and never reaches the page. Remove `"Hi #{user.name}"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= content_tag :div, "Hi #{user.name}" do %>
        World
      <% end %>
    `)
  })

  test("fails for `link_to` with content, URL and a block", () => {
    expectError('The `link_to` helper shifts its arguments when it is given a block, so `"Go"` is read as `options` and `root_path` as `html_options` instead of as content. Rails expects a Hash in `html_options` and raises when it is not one. Remove `"Go"` and let the block render the content.', [1, 12])

    assertOffenses(dedent`
      <%= link_to "Go", root_path do %>
        Go now
      <% end %>
    `)
  })

  test("fails for `button_to` with content, URL and a block", () => {
    expectError('The `button_to` helper shifts its arguments when it is given a block, so `"Delete"` is read as `options` and `article_path(article)` as `html_options` instead of as content. Rails expects a Hash in `html_options` and raises when it is not one. Remove `"Delete"` and let the block render the content.')

    assertOffenses(dedent`
      <%= button_to "Delete", article_path(article) do %>
        Delete now
      <% end %>
    `)
  })

  test("fails for `mail_to` with a name argument and a block", () => {
    expectError('The `mail_to` helper renders either its content argument or its block, never both, and the block wins, so `"Support"` is silently discarded and never reaches the page. Remove `"Support"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= mail_to "support@example.com", "Support" do %>
        Contact us
      <% end %>
    `)
  })

  test("fails for `phone_to` with a name argument and a block", () => {
    expectError('The `phone_to` helper renders either its content argument or its block, never both, and the block wins, so `"Call"` is silently discarded and never reaches the page. Remove `"Call"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= phone_to "+41000000000", "Call" do %>
        Call us
      <% end %>
    `)
  })

  test("fails for `sms_to` with a name argument and a block", () => {
    expectError('The `sms_to` helper renders either its content argument or its block, never both, and the block wins, so `"Text"` is silently discarded and never reaches the page. Remove `"Text"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= sms_to "+41000000000", "Text" do %>
        Text us
      <% end %>
    `)
  })

  test("fails for `button_tag` with a content argument and a block", () => {
    expectError('The `button_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Save"` is silently discarded and never reaches the page. Remove `"Save"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= button_tag "Save" do %>
        Submit
      <% end %>
    `)
  })

  test("fails for `label_tag` with a content argument and a block", () => {
    expectError('The `label_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Email"` is silently discarded and never reaches the page. Remove `"Email"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <%= label_tag :email, "Email" do %>
        Email address
      <% end %>
    `)
  })

  test("fails for an inline brace block", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Hello"` is silently discarded and never reaches the page. Remove `"Hello"`, or remove the block and let the argument render the content.')

    assertOffenses(`<%= content_tag(:div, "Hello") { "World" } %>`)
  })

  test("fails inside a silent ERB tag", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Hello"` is silently discarded and never reaches the page. Remove `"Hello"`, or remove the block and let the argument render the content.')

    assertOffenses(dedent`
      <% content_tag :div, "Hello" do %>
        World
      <% end %>
    `)
  })

  test("fails inside an HTML attribute value", () => {
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Hello"` is silently discarded and never reaches the page. Remove `"Hello"`, or remove the block and let the argument render the content.')

    assertOffenses(`<div title="<%= content_tag(:span, "Hello") { "World" } %>"></div>`)
  })

  test("reports every offending helper in one template", () => {
    expectError('The `tag.span` helper renders either its content argument or its block, never both, and the block wins, so `"One"` is silently discarded and never reaches the page. Remove `"One"`, or remove the block and let the argument render the content.', [2])
    expectError('The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Two"` is silently discarded and never reaches the page. Remove `"Two"`, or remove the block and let the argument render the content.', [6])
    expectError('The `link_to` helper shifts its arguments when it is given a block, so `"Three"` is read as `options` and `root_path` as `html_options` instead of as content. Rails expects a Hash in `html_options` and raises when it is not one. Remove `"Three"` and let the block render the content.', [10])

    assertOffenses(dedent`
      <div>
        <%= tag.span "One" do %>
          <%= one %>
        <% end %>

        <%= content_tag :p, "Two" do %>
          <%= two %>
        <% end %>

        <%= link_to "Three", root_path do %>
          <%= three %>
        <% end %>
      </div>
    `)
  })

  test("reports a nested offending helper", () => {
    expectError('The `tag.span` helper renders either its content argument or its block, never both, and the block wins, so `"Inner"` is silently discarded and never reaches the page. Remove `"Inner"`, or remove the block and let the argument render the content.')

    assertOffenses(`<%= content_tag(:div, tag.span("Inner") { "Nested" }) %>`)
  })

  describe("real templates from herb-corpus", () => {
    test("passes for an options hash reaching `content_tag` as a method call", () => {
      expectNoOffenses(dedent`
        <%= content_tag(:div, container_attributes) do %>
          <%= content %>
        <% end %>
      `)
    })

    test("passes for an options hash reaching `content_tag` as an instance variable", () => {
      expectNoOffenses(dedent`
        <%= content_tag(list_tag, @system_arguments) do %>
          <%= content %>
        <% end %>
      `)
    })

    test("passes for an options hash reaching `button_tag` as a local variable", () => {
      expectNoOffenses(dedent`
        <%= button_tag opts do %>
          Save
        <% end %>
      `)
    })

    test("passes for `link_to` given a URL and an options hash as instance variables", () => {
      expectNoOffenses(dedent`
        <%= link_to @url, @params do %>
          <%= content %>
        <% end %>
      `)
    })

    test("passes for `label_tag` given a name and options as instance variables", () => {
      expectNoOffenses(dedent`
        <%= label_tag(@name, @label_options) do %>
          <%= content %>
        <% end %>
      `)
    })

    test("passes for `label_tag` given explicit `nil` arguments", () => {
      expectNoOffenses(dedent`
        <%= label_tag(nil, nil, class: radio_label) do %>
          <%= content %>
        <% end %>
      `)
    })

    test("passes for an options hash built by a trailing conditional", () => {
      expectNoOffenses(dedent`
        <%= content_tag "tr", ({ data: { href: donor_path(donor_id) } } if donor_id) do %>
          <%= content %>
        <% end %>
      `)
    })

    test("passes for `tag.send` and `tag.public_send` with a dynamic tag name", () => {
      expectNoOffenses(dedent`
        <%= tag.send(tag_name, **tag_params) do %>
          <%= content %>
        <% end %>
      `)
    })

    test("fizzy: button label argument next to a block that renders an icon and its own label", () => {
      expectError('The `button_tag` helper renders either its content argument or its block, never both, and the block wins, so `"Create a new tag"` is silently discarded and never reaches the page. Remove `"Create a new tag"`, or remove the block and let the argument render the content.')

      assertOffenses(dedent`
        <li class="popup__item" data-navigable-list-target="item">
          <%= button_tag "Create a new tag", type: "submit", form: dom_id(@card, :tags_form), class: "btn popup__btn", data: { form_target: "submit" } do %>
            <%= icon_tag "add" %>
            <span>Create tag</span>
          <% end %>
        </li>
      `)
    })

    test("workshop.codes: `tag.span` called with a leading symbol as if it were `label_tag`", () => {
      expectError('The `tag.span` helper renders either its content argument or its block, never both, and the block wins, so `:categories` is silently discarded and never reaches the page. Remove `:categories`, or remove the block and let the argument render the content.')

      assertOffenses(dedent`
        <div class="form-group">
          <%= tag.span :categories, class: "form-label" do %>
            Categories
            <span class="form-required">(Required)</span>
          <% end %>
        </div>
      `)
    })

    test("SearchWorks: label text duplicated between the argument and the block", () => {
      expectError("The `label_tag` helper renders either its content argument or its block, never both, and the block wins, so `'Show collections only'` is silently discarded and never reaches the page. Remove `'Show collections only'`, or remove the block and let the argument render the content.")

      assertOffenses(dedent`
        <%= label_tag('digital_collection_all', 'Show collections only', class: 'position-relative') do %>
          <%= link_to(digital_collections_only_path, class: 'ms-1') do %>
            <%= 'Show collections only' %>
          <% end %>
        <% end %>
      `)
    })

    test("timeoverflow: label argument dropped in favour of a block", () => {
      expectError('The `label_tag` helper renders either its content argument or its block, never both, and the block wins, so `"avatar"` is silently discarded and never reaches the page. Remove `"avatar"`, or remove the block and let the argument render the content.')

      assertOffenses(dedent`
        <%= label_tag "avatar-js", "avatar", class: "form-label" do %>
          <a class="btn btn-link">
            <%= t ".change_your_image" %>
          </a>
        <% end %>
      `)
    })

    test("open-source-billing: an option passed positionally instead of as a keyword", () => {
      expectError('The `button_tag` helper renders either its content argument or its block, never both, and the block wins, so `:submit` is silently discarded and never reaches the page. Remove `:submit`, or remove the block and let the argument render the content.')

      assertOffenses(dedent`
        <%= button_tag :submit, name: 'save_as_draft', value: true, title: t('views.common.save'), class: 'invoice_submit_button' do %>
          <i class="material-icons">done</i>
        <% end %>
      `)
    })

    test("helpy: empty content argument alongside an interpolated class", () => {
      expectError("The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `''` is silently discarded and never reaches the page. Remove `''`, or remove the block and let the argument render the content.")

      assertOffenses(dedent`
        <%= content_tag(:li, '' , class: "click-loader new-discussion #{new_active_class}") do %>
          <%= navbar_expanding_link(new_admin_topic_path, "fas fa-plus") %>
        <% end %>
      `)
    })

    test("pageflow: empty content argument on a call using a trim marker", () => {
      expectError("The `content_tag` helper renders either its content argument or its block, never both, and the block wins, so `''` is silently discarded and never reaches the page. Remove `''`, or remove the block and let the argument render the content.")

      assertOffenses(dedent`
        <%= content_tag(:div, '', data: {widget: name}) do -%>
          <% if server_rendering -%>
            <% concat render_widget_react_component(entry, name) %>
          <% end %>
        <% end %>
      `)
    })

    test("hyrax: empty content argument on a call whose options span several lines", () => {
      expectError("The `button_tag` helper renders either its content argument or its block, never both, and the block wins, so `''` is silently discarded and never reaches the page. Remove `''`, or remove the block and let the argument render the content.", [1, 15])

      assertOffenses(dedent`
        <%= button_tag '',
                      class: 'btn btn-primary add-to-collection',
                      title: t("hyrax.collection.actions.nested_subcollection.desc"),
                      type: 'button',
                      data: { nestable: presenter.collection_type_is_nestable?,
                              hasaccess: true } do %>
          <%= t('hyrax.collection.actions.nested_subcollection.button_label') %>
        <% end %>
      `)
    })
  })
})
