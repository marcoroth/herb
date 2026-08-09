import { describe, it } from "vitest"
import dedent from "dedent"

import { ActionViewNoImplicitPolymorphicURLRule } from "../../src/rules/actionview-no-implicit-polymorphic-url"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectInfo, expectError, assertOffenses } = createLinterTest(ActionViewNoImplicitPolymorphicURLRule)

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

  it("flags a namespaced Array URL", () => {
    expectInfo("Avoid passing `[:admin, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_path(@user)`, or `polymorphic_path([:admin, @user])` when the route has to be resolved from the model.", { line: 1, column: 20 })

    assertOffenses(`<%= link_to "User", [:admin, @user] %>`)
  })

  it("flags an Array URL with a leading action", () => {
    expectInfo("Avoid passing `[:edit, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `edit_user_path(@user)`, or `polymorphic_path([:edit, @user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Edit User", [:edit, @user] %>`)
  })

  it("flags a nested Array URL", () => {
    expectInfo("Avoid passing `[@post, @comment]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `post_comment_path(@post, @comment)`, or `polymorphic_path([@post, @comment])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Comment", [@post, @comment] %>`)
  })

  it("flags a namespaced nested Array URL", () => {
    expectInfo("Avoid passing `[:admin, @blog, @post]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_blog_post_path(@blog, @post)`, or `polymorphic_path([:admin, @blog, @post])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Post", [:admin, @blog, @post] %>`)
  })

  it("flags an Array URL with a Symbol between two model objects", () => {
    expectInfo("Avoid passing `[@user, :blog, @post]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `user_blog_post_path(@user, @post)`, or `polymorphic_path([@user, :blog, @post])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Post", [@user, :blog, @post] %>`)
  })

  it("flags an Array URL for a nested collection", () => {
    expectInfo("Avoid passing `[@post, :comments]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `post_comments_path(@post)`, or `polymorphic_path([@post, :comments])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Comments", [@post, :comments] %>`)
  })

  it("flags an Array URL built from Symbols only", () => {
    expectInfo("Avoid passing `[:admin, :users]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_users_path`, or `polymorphic_path([:admin, :users])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Users", [:admin, :users] %>`)
  })

  it("flags an Array URL written as a Symbol Array literal", () => {
    expectInfo("Avoid passing `%i[admin users]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_users_path`, or `polymorphic_path(%i[admin users])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Users", %i[admin users] %>`)
  })

  it("flags an Array URL holding a single model object", () => {
    expectInfo("Avoid passing `[@user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `user_path(@user)`, or `polymorphic_path([@user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "User", [@user] %>`)
  })

  it("flags an Array URL passed as the only argument", () => {
    expectInfo("Avoid passing `[:admin, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_path(@user)`, or `polymorphic_path([:admin, @user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to [:admin, @user] %>`)
  })

  it("flags an Array URL passed to a `link_to` with a block", () => {
    expectInfo("Avoid passing `[:admin, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_path(@user)`, or `polymorphic_path([:admin, @user])` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <%= link_to [:admin, @user] do %>
        User
      <% end %>
    `)
  })

  it("flags an Array URL followed by HTML options", () => {
    expectInfo("Avoid passing `[:admin, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_path(@user)`, or `polymorphic_path([:admin, @user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "User", [:admin, @user], class: "btn" %>`)
  })

  it("flags an Array URL holding a block-local record", () => {
    expectInfo("Avoid passing `[:admin, user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_path(user)`, or `polymorphic_path([:admin, user])` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <%= link_to user.name, [:admin, user] %>
      <% end %>
    `)
  })

  it("flags an Array URL holding a method call, without naming a route helper", () => {
    expectInfo("Avoid passing `[:admin, @user.account]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path([:admin, @user.account])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Account", [:admin, @user.account] %>`)
  })

  it("flags an Array URL built from a splat, without naming a route helper", () => {
    expectInfo("Avoid passing `[*@parents, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path([*@parents, @user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "User", [*@parents, @user] %>`)
  })

  it("flags an Array URL holding a model class, without naming a route helper", () => {
    expectInfo("Avoid passing `[:admin, User]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path([:admin, User])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Users", [:admin, User] %>`)
  })

  it("flags an Array URL holding an instance variable named after a URL", () => {
    expectInfo("Avoid passing `[:admin, @user_url]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_url_path(@user_url)`, or `polymorphic_path([:admin, @user_url])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "User", [:admin, @user_url] %>`)
  })

  it("passes for an explicit route helper built from an Array element", () => {
    expectNoOffenses(`<%= link_to "User", admin_user_path(@user) %>`)
  })

  it("passes for an Array URL passed to `polymorphic_path`", () => {
    expectNoOffenses(`<%= link_to "User", polymorphic_path([:admin, @user]) %>`)
  })

  it("flags an Array URL holding a String, which Rails rejects in favor of a Symbol", () => {
    expectInfo("Avoid passing `[\"admin\", @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `admin_user_path(@user)`, or `polymorphic_path([\"admin\", @user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "User", ["admin", @user] %>`)
  })

  it("flags a model object read off another model", () => {
    expectInfo("Avoid passing `@user.account` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path(@user.account)` when the route has to be resolved from the model.", { line: 1, column: 23 })

    assertOffenses(`<%= link_to "Account", @user.account %>`)
  })

  it("flags a model object read off a block-local record", () => {
    expectInfo("Avoid passing `user.account` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path(user.account)` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <%= link_to "Account", user.account %>
      <% end %>
    `)
  })

  it("flags a model object read through a safe navigation call", () => {
    expectInfo("Avoid passing `@user&.account` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path(@user&.account)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Account", @user&.account %>`)
  })

  it("flags a model object read off a chain of models", () => {
    expectInfo("Avoid passing `@post.author.profile` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper, or `polymorphic_path(@post.author.profile)` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "Profile", @post.author.profile %>`)
  })

  it("passes for a method call named after a URL", () => {
    expectNoOffenses(`<%= link_to "Avatar", @user.avatar_url %>`)
  })

  it("passes for a method call reading a URL off the request", () => {
    expectNoOffenses(`<%= link_to "Back", request.referer %>`)
  })

  it("passes for a URL read out of a Hash", () => {
    expectNoOffenses(`<%= link_to "Back", params[:return_to] %>`)
  })

  it("passes for a method call taking arguments", () => {
    expectNoOffenses(`<%= link_to "Account", @user.account_for(@company) %>`)
  })

  it("passes for a predicate method call in a different argument position", () => {
    expectNoOffenses(`<%= link_to_if @user.admin?, "Profile", profile_path(@profile) %>`)
  })

  it("flags an empty Array URL, which raises at runtime", () => {
    expectError("Passing `[]` to `link_to` raises `ArgumentError: Nil location provided. Can't build URI.` at runtime. Rails compacts the Array before it resolves the route, and an Array with nothing left in it has no route to resolve. Use an explicit route helper for the route this link points at.", { line: 1, column: 20 })

    assertOffenses(`<%= link_to "User", [] %>`)
  })

  it("flags an Array URL holding only `nil`, which raises at runtime", () => {
    expectError("Passing `[nil]` to `link_to` raises `ArgumentError: Nil location provided. Can't build URI.` at runtime. Rails compacts the Array before it resolves the route, and an Array with nothing left in it has no route to resolve. Use an explicit route helper for the route this link points at.")

    assertOffenses(`<%= link_to "User", [nil] %>`)
  })

  it("flags an Array URL holding `nil` alongside a model object, which Rails compacts away", () => {
    expectInfo("Avoid passing `[nil, @user]` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `user_path(@user)`, or `polymorphic_path([nil, @user])` when the route has to be resolved from the model.")

    assertOffenses(`<%= link_to "User", [nil, @user] %>`)
  })

  it("flags a block-local record passed as the URL argument", () => {
    expectInfo("Avoid passing `user` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `user_path(user)`, or `polymorphic_path(user)` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <%= link_to user.name, user %>
      <% end %>
    `)
  })

  it("flags a local variable assigned in the template", () => {
    expectInfo("Avoid passing `record` directly to `link_to`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `record_path(record)`, or `polymorphic_path(record)` when the route has to be resolved from the model.")

    assertOffenses(dedent`
      <% record = @post %>
      <%= link_to "Post", record %>
    `)
  })

  it("passes for a local variable named after a URL", () => {
    expectNoOffenses(dedent`
      <% @links.each do |link_url| %>
        <%= link_to "Link", link_url %>
      <% end %>
    `)
  })

  it("passes for a receiverless method call, which can't be told apart from a helper returning a URL", () => {
    expectNoOffenses(`<%= link_to "Profile", current_user %>`)
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
