import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewPreferLinkToHelperRule } from "../../src/rules/actionview-prefer-link-to-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewPreferLinkToHelperRule)

const BYTE_ORDER_MARK = "\uFEFF"

describe("actionview-prefer-link-to-helper", () => {
  test("passes for `link_to` with static text", () => {
    expectNoOffenses('<%= link_to "Dashboard", dashboard_path %>', { framework: "actionview" })
  })

  test("passes for `link_to` with a block", () => {
    expectNoOffenses(dedent`
      <%= link_to user_path(@user), class: "btn" do %>
        Profile
      <% end %>
    `, { framework: "actionview" })
  })

  test("passes for an anchor with a static href", () => {
    expectNoOffenses('<a href="https://example.com">Example</a>', { framework: "actionview" })
  })

  test("passes for an anchor with a fragment href", () => {
    expectNoOffenses('<a href="#main">Skip to content</a>', { framework: "actionview" })
  })

  test("passes for an anchor without an href", () => {
    expectNoOffenses('<a name="anchor">Anchor</a>', { framework: "actionview" })
  })

  test("passes when the framework is not Action View", () => {
    expectNoOffenses('<a href="<%= dashboard_path %>">Dashboard</a>')
  })

  test("passes for an href that holds more than the expression", () => {
    expectNoOffenses('<a href="<%= root_path %>#section">Section</a>', { framework: "actionview" })
  })

  test("passes for an href whose expression carries its own control flow", () => {
    expectNoOffenses('<a href="<%= @event.url if @event.published? %>">Event</a>', { framework: "actionview" })
  })

  test("passes for a silent tag in the href", () => {
    expectNoOffenses('<a href="<% dashboard_path %>">Dashboard</a>', { framework: "actionview" })
  })

  test("passes for an ERB comment in the href", () => {
    expectNoOffenses('<a href="<%# dashboard_path %>">Dashboard</a>', { framework: "actionview" })
  })

  test("passes for an ERB expression in another attribute", () => {
    expectNoOffenses('<div data-url="<%= dashboard_path %>">Content</div>', { framework: "actionview" })
  })

  test("passes for an ERB expression in a non-anchor element", () => {
    expectNoOffenses('<form action="<%= users_path %>" method="post"></form>', { framework: "actionview" })
  })

  test("fails for an anchor with a `_path` helper", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= dashboard_path %>">Dashboard</a>', { framework: "actionview" })
  })

  test("fails for an anchor with a `_url` helper", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Unsubscribe", unsubscribe_url(@user) %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= unsubscribe_url(@user) %>">Unsubscribe</a>', { framework: "actionview" })
  })

  test("fails for an anchor with a `url_for` call", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Show", url_for(@post) %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= url_for(@post) %>">Show</a>', { framework: "actionview" })
  })

  test("fails for an href built from an instance variable", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Docs", @external_url %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= @external_url %>">Docs</a>', { framework: "actionview" })
  })

  test("fails for an href built from a method on a receiver", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Avatar", @user.avatar_url %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= @user.avatar_url %>">Avatar</a>', { framework: "actionview" })
  })

  test("fails for an href built from a local variable", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Avatar", avatar_url %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <% avatar_url = @user.avatar.url %>
      <a href="<%= avatar_url %>">Avatar</a>
    `, { framework: "actionview" })
  })

  test("fails for an href built from string interpolation", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", "#{root_path}?ref=nav" %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= "#{root_path}?ref=nav" %>">Home</a>', { framework: "actionview" })
  })

  test("moves the other attributes into the options", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Profile", user_path(@user), class: "btn" %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= user_path(@user) %>" class="btn">Profile</a>', { framework: "actionview" })
  })

  test("nests `data-` and `aria-` attributes into their own hashes", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Delete", post_path(@post), class: "btn", data: { turbo_method: "delete", turbo_confirm: "Sure?" }, aria: { label: "Delete post" } %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= post_path(@post) %>" class="btn" data-turbo-method="delete" data-turbo-confirm="Sure?" aria-label="Delete post">Delete</a>', { framework: "actionview" })
  })

  test("interpolates ERB inside an attribute value", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path, class: "btn #{extra}" %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" class="btn <%= extra %>">Home</a>', { framework: "actionview" })
  })

  test("passes an attribute that is entirely ERB through as an expression", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path, class: css_classes %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" class="<%= css_classes %>">Home</a>', { framework: "actionview" })
  })

  test("reports at the `href` attribute", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.', [1, 3])

    assertOffenses('<a href="<%= dashboard_path %>">Dashboard</a>', { framework: "actionview" })
  })

  test("collapses the link text onto one line", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "All posts", posts_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <a href="<%= posts_path %>">
        All
        posts
      </a>
    `, { framework: "actionview" })
  })

  test("collapses a multi-line expression onto one line", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Show", post_path( @post ) %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <a href="<%= post_path(
        @post
      ) %>">Show</a>
    `, { framework: "actionview" })
  })

  test("wraps a paren-less href call in parentheses", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Back", (url_for action: :index) %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= url_for action: :index %>">Back</a>', { framework: "actionview" })
  })

  test("wraps a paren-less link text call in parentheses", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to (image_tag "logo.svg", alt: "Home"), root_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>"><%= image_tag "logo.svg", alt: "Home" %></a>', { framework: "actionview" })
  })

  test("suggests the ERB expression as the link text", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to post.title, post_path(post) %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= post_path(post) %>"><%= post.title %></a>', { framework: "actionview" })
  })

  test("suggests the block form for nested markup", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to post_path(@post) do %>` with the link\'s content in the block instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <a href="<%= post_path(@post) %>">
        <span class="icon"></span>
        Read more
      </a>
    `, { framework: "actionview" })
  })

  test("suggests the block form for an empty anchor", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to dashboard_path do %>` with the link\'s content in the block instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= dashboard_path %>"></a>', { framework: "actionview" })
  })

  test("suggests the block form when the link text cannot be quoted", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to guides_path do %>` with the link\'s content in the block instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= guides_path %>">Read the "guides"</a>', { framework: "actionview" })
  })

  test("suggests the block form when the link text holds an entity reference", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to dashboard_path do %>` with the link\'s content in the block instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= dashboard_path %>">&nbsp;</a>', { framework: "actionview" })
  })

  test("suggests the block form when the link text carries its own control flow", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to event_url(@event) do %>` with the link\'s content in the block instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= event_url(@event) %>"><%= @event.title if @event.titled? %></a>', { framework: "actionview" })
  })

  test("escapes a double quote in an attribute value", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path, title: "He said \\"hi\\"" %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(`<a href="<%= root_path %>" title='He said "hi"'>Home</a>`, { framework: "actionview" })
  })

  test("leaves an attribute value holding an entity reference out of the suggestion", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path %>` with the remaining attributes as options instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" title="a &amp; b">Home</a>', { framework: "actionview" })
  })

  test("leaves a valueless attribute out of the suggestion", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "File", root_path %>` with the remaining attributes as options instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" download>File</a>', { framework: "actionview" })
  })

  test("leaves an attribute name that is not a Ruby key out of the suggestion", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path %>` with the remaining attributes as options instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" @click="go()">Home</a>', { framework: "actionview" })
  })

  test("leaves a repeated attribute out of the suggestion", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path %>` with the remaining attributes as options instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" target="_blank" target="_self">Home</a>', { framework: "actionview" })
  })

  test("leaves a dynamic attribute name out of the suggestion", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Home", root_path %>` with the remaining attributes as options instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= root_path %>" data-<%= key %>="value">Home</a>', { framework: "actionview" })
  })

  test("names both moves when the content and the attributes have to move", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to root_path do %>` with the link\'s content in the block and the remaining attributes as options instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <a href="<%= root_path %>" download>
        <span class="icon"></span>
        File
      </a>
    `, { framework: "actionview" })
  })

  test("reads the expression from the tag rather than by offset when the file starts with a byte order mark", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Sponsor", spon[:url] %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(BYTE_ORDER_MARK + '<a href="<%= spon[:url] %>">Sponsor</a>', { framework: "actionview" })
  })

  test("parenthesizes a paren-less call when the file starts with a byte order mark", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to (image_tag "sponsors/" + spon[:img], class: "w-75"), spon[:url], target: "_blank" %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(BYTE_ORDER_MARK + dedent`
      <a target="_blank" href="<%= spon[:url] %>">
        <%= image_tag "sponsors/" + spon[:img], class: "w-75" %>
      </a>
    `, { framework: "actionview" })
  })

  test("does not parenthesize an operator call", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Topic", Discourse.base_url + topic.relative_url %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%= Discourse.base_url + topic.relative_url %>">Topic</a>', { framework: "actionview" })
  })

  test("fails for a raw output tag", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href="<%== dashboard_path %>">Dashboard</a>', { framework: "actionview" })
  })

  test("fails for an anchor with an unquoted href", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<a href=<%= dashboard_path %>>Dashboard</a>', { framework: "actionview" })
  })

  test("fails for anchors nested in other elements", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <nav>
        <ul>
          <li><a href="<%= dashboard_path %>">Dashboard</a></li>
        </ul>
      </nav>
    `, { framework: "actionview" })
  })

  test("reports every offending anchor", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.', [2, 5])
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Settings", settings_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.', [3, 5])

    assertOffenses(dedent`
      <nav>
        <a href="<%= dashboard_path %>">Dashboard</a>
        <a href="<%= settings_path %>">Settings</a>
        <a href="/about">About</a>
      </nav>
    `, { framework: "actionview" })
  })

  test("fails inside ERB control flow", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Sign in", new_session_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <% if current_user.nil? %>
        <a href="<%= new_session_path %>">Sign in</a>
      <% end %>
    `, { framework: "actionview" })
  })

  test("fails for an anchor inside a template element", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses(dedent`
      <template>
        <a href="<%= dashboard_path %>">Dashboard</a>
      </template>
    `, { framework: "actionview" })
  })

  test("fails for an anchor with an uppercase tag name", () => {
    expectInfo('Prefer the `link_to` helper over a manual `<a>` tag with an ERB `href`. Write `<%= link_to "Dashboard", dashboard_path %>` instead, which is the Action View API for links and keeps the URL and the link\'s attributes in one Ruby call.')

    assertOffenses('<A HREF="<%= dashboard_path %>">Dashboard</A>', { framework: "actionview" })
  })
})
