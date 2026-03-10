# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class TernaryTest < Minitest::Spec
    include SnapshotUtils

    test "ternary operator in ERB output tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= condition ? true_value : false_value %>
      HTML
    end

    test "complex ternary operator with method calls" do
      assert_parsed_snapshot(<<~HTML)
        <%= @user.new_record? ? new_user_path(name: @user.name) : edit_user_path(@user, name: @user.name) %>
      HTML
    end

    test "ternary operator in form_with" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with model: @post, url: @post.new_record? ? posts_path : post_path(@post) do |f| %>
          Content
        <% end %>
      HTML
    end

    test "nested ternary operators" do
      assert_parsed_snapshot(<<~HTML)
        <%= status == :active ? "Active" : (status == :pending ? "Pending" : "Inactive") %>
      HTML
    end

    test "ternary operator in attribute value" do
      assert_parsed_snapshot(<<~HTML)
        <div class="<%= active? ? 'active' : 'inactive' %>">Content</div>
      HTML
    end

    test "multiple ternary operators in same ERB tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to (user.admin? ? "Admin" : "User"), (user.active? ? active_path : inactive_path) %>
      HTML
    end

    test "ternary operator with blocks" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, class: (visible? ? "show" : "hide") do %>
          Content
        <% end %>
      HTML
    end

    test "form_with helper with ternary in url parameter" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with model: @user, url: @user.new_record? ? users_path : user_path(@user), method: @user.new_record? ? :post : :patch do |form| %>
          <%= form.text_field :name %>
          <%= form.submit %>
        <% end %>
      HTML
    end

    test "content_tag with ternary for class attribute" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, "Hello World", class: current_user.admin? ? "admin-panel" : "user-panel" %>
      HTML
    end

    test "content_tag with ternary for data attribute" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :button, "Click me",
            data: {
              action: @item.published? ? "unpublish" : "publish",
              confirm: @item.published? ? "Are you sure you want to unpublish?" : "Are you sure you want to publish?"
            } %>
      HTML
    end

    test "form_with with complex ternary in multiple attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with model: @article,
                      url: @article.persisted? ? article_path(@article) : articles_path,
                      html: { class: @article.draft? ? "draft-form" : "published-form" },
                      local: @article.draft? ? true : false do |f| %>
          <%= f.text_field :title %>
        <% end %>
      HTML
    end

    test "inline if modifier in ERB output tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= render 'partial' if user_signed_in? %>
      HTML
    end

    test "inline unless modifier in ERB output tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Home", root_path unless current_page?(root_path) %>
      HTML
    end
  end
end
