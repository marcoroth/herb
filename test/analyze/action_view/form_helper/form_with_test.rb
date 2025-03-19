# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::FormHelper
  class FormWithTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "form_with with url" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with url: posts_path do |form| %>
        <% end %>
      HTML
    end

    test "form_with with url false" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with url: false do |form| %>
        <% end %>
      HTML
    end

    test "form_with with scope and url" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with scope: :post, url: posts_path do |form| %>
        <% end %>
      HTML
    end

    test "form_with with new model" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with model: Post.new do |form| %>
        <% end %>
      HTML
    end

    test "form_with with model instance" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with model: Post.first do |form| %>
        <% end %>
      HTML
    end

    test "form_with with scope, url and method instance" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with scope: :post, url: post_path(@post), method: :patch do |form| %>
        <% end %>
      HTML
    end
  end
end
