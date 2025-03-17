# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class ButtonToTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "button_to" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to "Click Me", false %>
      HTML
    end

    test "button_to with action" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to "New", action: "new" %>
      HTML
    end

    test "button_to with path helper" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to "New", new_article_path %>
      HTML
    end

    test "button_to with params" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to "New", new_article_path, params: { time: Time.now  } %>
      HTML
    end

    test "button_to with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to [:make_happy, @user] do %>
          Make happy <strong><%= @user.name %></strong>
        <% end %>
      HTML
    end

    test "button_to with form_class" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to "New", { action: "new" }, form_class: "new-thing" %>
      HTML
    end

    test "button_to with form" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to "Create", { action: "create" }, form: { "data-type" => "json" } %>
      HTML
    end
  end
end
