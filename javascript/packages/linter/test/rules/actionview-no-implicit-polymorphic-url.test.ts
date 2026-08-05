import { describe, it } from "vitest"
import dedent from "dedent"

import { ActionViewNoImplicitPolymorphicURLRule } from "../../src/rules/actionview-no-implicit-polymorphic-url"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, assertOffenses } = createLinterTest(ActionViewNoImplicitPolymorphicURLRule)

describe("actionview-no-implicit-polymorphic-url", () => {
  it("flags a model object passed as the only argument", () => {
    expectInfo("Avoid passing `@profile` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `profile_path(@profile)`, or `polymorphic_path(@profile)` when the route has to be resolved from the model.", { line: 1, column: 12 })

    assertOffenses(`<%= link_to @profile %>`)
  })

  it("flags a model object passed as the URL argument", () => {
    expectInfo("Avoid passing `@profile` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `profile_path(@profile)`, or `polymorphic_path(@profile)` when the route has to be resolved from the model.", { line: 1, column: 23 })

    assertOffenses(`<%= link_to "Profile", @profile %>`)
  })

  it("flags a model object when the link text reads from the same model", () => {
    expectInfo("Avoid passing `@user` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `user_path(@user)`, or `polymorphic_path(@user)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to @user.name, @user %>`)
  })

  it("flags a model object followed by HTML options", () => {
    expectInfo("Avoid passing `@post` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `post_path(@post)`, or `polymorphic_path(@post)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "View Post", @post, class: "btn" %>`)
  })

  it("flags a model object passed with explicit parentheses", () => {
    expectInfo("Avoid passing `@post` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `post_path(@post)`, or `polymorphic_path(@post)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to("View Post", @post) %>`)
  })

  it("flags a model object passed to a `link_to` with a block", () => {
    expectInfo("Avoid passing `@profile` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `profile_path(@profile)`, or `polymorphic_path(@profile)` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <%= link_to @profile do %>
        Profile
      <% end %>
    `)
  })

  it("flags a model object passed to a nested `link_to`", () => {
    expectInfo("Avoid passing `@post` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `post_path(@post)`, or `polymorphic_path(@post)` when the route has to be resolved from the model.")

    assertOffenses(`<%= content_tag(:li, link_to("View Post", @post)) %>`)
  })

  it("flags a model object inside a control flow block", () => {
    expectInfo("Avoid passing `@post` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `post_path(@post)`, or `polymorphic_path(@post)` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <% if @post %>
        <%= link_to "View Post", @post %>
      <% end %>
    `)
  })

  it("flags every occurrence in a template", () => {
    expectInfo("Avoid passing `@profile` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `profile_path(@profile)`, or `polymorphic_path(@profile)` when the route has to be resolved from the model.")
    expectInfo("Avoid passing `@user` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `user_path(@user)`, or `polymorphic_path(@user)` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <nav>
        <%= link_to "Profile", @profile %>
        <%= link_to @user.name, @user %>
      </nav>
    `)
  })

  it("passes for an explicit route helper", () => {
    expectNoOffenses(`<%= link_to "Profile", profile_path(@profile) %>`)
  })

  it("passes for an explicit route helper for a member action", () => {
    expectNoOffenses(`<%= link_to "Edit Profile", edit_profile_path(@profile) %>`)
  })

  it("passes for an explicit route helper with HTML options", () => {
    expectNoOffenses(`<%= link_to "View Post", post_path(@post), class: "btn" %>`)
  })

  it("passes for an explicit route helper without arguments", () => {
    expectNoOffenses(`<%= link_to "Articles", articles_path %>`)
  })

  it("passes for a hardcoded String path", () => {
    expectNoOffenses(`<%= link_to "Articles", "/articles" %>`)
  })

  it("passes for a Hash of URL options", () => {
    expectNoOffenses(`<%= link_to "Articles", controller: "articles", action: "index" %>`)
  })

  it("passes for an explicit route helper inside a `link_to` with a block", () => {
    expectNoOffenses(dedent`
      <%= link_to profile_path(@profile) do %>
        Profile
      <% end %>
    `)
  })

  it("passes when the model object is only used as the link text", () => {
    expectNoOffenses(`<%= link_to @user.name, user_path(@user) %>`)
  })

  it("passes for a model object passed to `polymorphic_path`", () => {
    expectNoOffenses(`<%= link_to "Profile", polymorphic_path(@profile) %>`)
  })

  it("passes for a model object passed to `polymorphic_url`", () => {
    expectNoOffenses(`<%= link_to "Profile", polymorphic_url(@profile) %>`)
  })

  it("passes for a model object passed to `edit_polymorphic_path`", () => {
    expectNoOffenses(`<%= link_to "Edit Profile", edit_polymorphic_path(@profile) %>`)
  })

  it("passes for a model object passed to `polymorphic_path` as the only argument", () => {
    expectNoOffenses(`<%= link_to polymorphic_path(@profile) %>`)
  })

  it("passes for a model object passed to `polymorphic_path` in a `link_to` with a block", () => {
    expectNoOffenses(dedent`
      <%= link_to polymorphic_path(@profile) do %>
        Profile
      <% end %>
    `)
  })

  it("passes for an instance variable named `@url`", () => {
    expectNoOffenses(`<%= link_to @url, @url %>`)
  })

  it("passes for an instance variable with a `_url` suffix", () => {
    expectNoOffenses(`<%= link_to "Reset your password", @reset_password_url %>`)
  })

  it("passes for an instance variable with a `_path` suffix", () => {
    expectNoOffenses(`<%= link_to "Preferences", @preferences_path %>`)
  })

  it("passes for an instance variable with a `url` suffix and no underscore", () => {
    expectNoOffenses(`<%= link_to "Reply", @replyurl %>`)
  })

  it("passes for an instance variable named `@href`", () => {
    expectNoOffenses(`<%= link_to "Details", @href %>`)
  })

  it("passes for an instance variable with a `_link` suffix", () => {
    expectNoOffenses(`<%= link_to "Unsubscribe", @unsubscribe_link %>`)
  })

  it("passes for an instance variable with a `_uri` suffix", () => {
    expectNoOffenses(`<%= link_to "Callback", @callback_uri %>`)
  })

  it("passes for an instance variable with a `url` segment in the middle", () => {
    expectNoOffenses(`<%= link_to "Sign in with IAL1", @start_url_ial1 %>`)
  })

  it("passes for an instance variable with an `_options` suffix", () => {
    expectNoOffenses(`<%= link_to "Show all", @link_options %>`)
  })

  it("passes for a model named after a URL, which is the accepted cost of the name heuristic", () => {
    expectNoOffenses(`<%= link_to "Shortener", @url_shortener %>`)
  })

  it("flags an instance variable that merely contains `url` inside a word", () => {
    expectInfo("Avoid passing `@burlington` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `burlington_path(@burlington)`, or `polymorphic_path(@burlington)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Burlington", @burlington %>`)
  })

  it("flags an instance variable that contains `uri` inside a word", () => {
    expectInfo("Avoid passing `@security` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `security_path(@security)`, or `polymorphic_path(@security)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Security", @security %>`)
  })

  it("passes for `link_to_if`, whose URL argument sits in a different position", () => {
    expectNoOffenses(`<%= link_to_if @user.admin?, "Profile", @profile %>`)
  })

  it("passes for `button_to`, which carries no `url_for` implicit attribute in the registry", () => {
    expectNoOffenses(`<%= button_to "Delete", @post, method: :delete %>`)
  })

  it("passes for a model object passed to another helper", () => {
    expectNoOffenses(`<%= form_with model: @profile do |form| %><% end %>`)
  })

  it("passes for a model object passed to a `link_to` on an explicit receiver", () => {
    expectNoOffenses(`<%= helpers.link_to "Profile", @profile %>`)
  })

  it("passes for `link_to` without arguments", () => {
    expectNoOffenses(`<%= link_to %>`)
  })

  it("passes for an anchor tag with an href", () => {
    expectNoOffenses(`<a href="/profile">Profile</a>`)
  })
})
