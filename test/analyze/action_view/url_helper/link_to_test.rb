# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class LinkToTest < Minitest::Spec
    include SnapshotUtils

    test "link_to" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click me", "#" %>
      HTML
    end

    test "link_to with html options" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click me", "#", class: "example" %>
      HTML
    end

    test "link_to with block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "#" do %>
          Click me
        <% end %>
      HTML
    end

    test "link_to with path helper" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click me", root_path %>
      HTML
    end

    test "link_to with method" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Delete", root_path, method: "delete" %>
      HTML
    end

    test "link_to with confirm" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Delete", root_path, data: { confirm: "Are you sure?" } %>
      HTML
    end

    test "link_to with data-turbo-method" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Delete", root_path, data: { turbo_method: "delete" } %>
      HTML
    end

    test "link_to with data-turbo-confirm" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Delete", root_path, data: { turbo_confirm: "Are you sure?" } %>
      HTML
    end

    test "link_to with :back" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Back", :back %>
      HTML
    end

    test "link_to with data attributes using string key hashrocket" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click", root_path, data: { "action" => "value" } %>
      HTML
    end

    test "link_to with data attributes using symbol key hashrocket" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click", root_path, data: { :action => "value" } %>
      HTML
    end

    test "link_to with block and path helper" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to root_path do %>
          Click me
        <% end %>
      HTML
    end

    test "link_to with block and path helper and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to root_path, class: "btn" do %>
          Click me
        <% end %>
      HTML
    end

    test "link_to with ruby expression as content" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to text, root_path %>
      HTML
    end

    test "link_to with nil content and string url" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to nil, "http://example.com" %>
      HTML
    end

    test "link_to with nil content and path helper" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to nil, root_path %>
      HTML
    end

    # Rails docs examples

    test "link_to with path helper with argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Profile", profile_path(@profile) %>
      HTML
    end

    test "link_to with model as url" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Profile", @profile %>
      HTML
    end

    test "link_to with model as single argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to @profile %>
      HTML
    end

    test "link_to with block and model" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to @profile do %>
          <strong><%= @profile.name %></strong>
        <% end %>
      HTML
    end

    test "link_to with id and class" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Articles", articles_path, id: "news", class: "article" %>
      HTML
    end

    test "link_to with target and rel" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "External link", "http://www.rubyonrails.org/", target: "_blank", rel: "nofollow" %>
      HTML
    end

    test "link_to with turbo_method on model" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Delete profile", @profile, data: { turbo_method: :delete } %>
      HTML
    end

    test "link_to with turbo_confirm and string url" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Visit Other Site", "https://rubyonrails.org/", data: { turbo_confirm: "Are you sure?" } %>
      HTML
    end

    test "link_to with path helper with anchor argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Comment wall", profile_path(@profile, anchor: "wall") %>
      HTML
    end

    test "link_to with path helper with multiple arguments" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Nonsense search", searches_path(foo: "bar", baz: "quux") %>
      HTML
    end

    test "link_to with method delete using rails ujs" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Remove Profile", profile_path(@profile), method: :delete %>
      HTML
    end

    test "link_to with data confirm using rails ujs" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Visit Other Site", "http://www.rubyonrails.org/", data: { confirm: "Are you sure?" } %>
      HTML
    end

    test "link_to with old-style controller action hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Profile", controller: "profiles", action: "show", id: @profile %>
      HTML
    end

    test "link_to with remote true" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Remote", root_path, remote: true %>
      HTML
    end

    test "link_to with data disable_with" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Submit", root_path, data: { disable_with: "Submitting..." } %>
      HTML
    end

    test "link_to with old-style controller action hash and class" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Profile", controller: "profiles", action: "show", id: @profile, class: "btn" %>
      HTML
    end

    test "link_to with explicit url hash and html options" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Profile", { controller: "profiles", action: "show" }, class: "btn" %>
      HTML
    end

    test "link_to with explicit url hash and html options block form" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to({ controller: "profiles", action: "show" }, class: "btn") do %>
          Profile
        <% end %>
      HTML
    end

    test "link_to with inline block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("#") { "Click me" } %>
      HTML
    end

    test "link_to with inline block and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("/about", class: "btn") { "About" } %>
      HTML
    end

    test "link_to with inline block and data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("/profile", data: { turbo_method: "delete" }) { "Delete" } %>
      HTML
    end

    test "link_to with inline block and path helper" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to(root_path) { "Home" } %>
      HTML
    end

    test "link_to with inline block and ruby expression" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("#") { @user.name } %>
      HTML
    end

    test "link_to with inline block and multiple data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("/profile", data: { turbo_method: "delete", turbo_confirm: "Sure?" }) { "Delete" } %>
      HTML
    end

    test "link_to with inline block and string url" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("/about") { "About Us" } %>
      HTML
    end

    test "link_to with inline block and path helper and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to(root_path, class: "btn", data: { turbo_method: "delete" }) { "Home" } %>
      HTML
    end

    test "link_to with inline block and explicit hash options" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("/about", { class: "btn" }) { "x" } %>
      HTML
    end

    test "link_to with inline block and variable options" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("/about", html_opts) { "About" } %>
      HTML
    end

    test "link_to with inline block and path helper with variable options" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to(root_path, options) { "Home" } %>
      HTML
    end

    test "link_to with inline block and string as second argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to("#", "argument") { "Block" } %>
      HTML
    end

    test "link_to with symbol hashrocket class attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click here", "/path", :class => "classes" %>
      HTML
    end

    test "link_to with string hashrocket class attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click here", "/path", "class" => "classes" %>
      HTML
    end

    test "link_to with label syntax class attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click here", "/path", class: "classes" %>
      HTML
    end

    test "link_to with quoted label syntax class attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click here", "/path", "class": "classes" %>
      HTML
    end

    test "link_to with mixed data attribute syntax" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= link_to "Click here", "/path", data: { controller: "hello", :hello => "value" } %>
      HTML
    end
  end
end
