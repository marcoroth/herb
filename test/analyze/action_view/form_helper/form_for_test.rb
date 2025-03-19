# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::FormHelper
  class FormForTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "form_for with symbol" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for :person do |f| %>
        <% end %>
      HTML
    end

    test "form_for with instance variable" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for @post do |f| %>
        <% end %>
      HTML
    end

    test "form_for with instance variable and as keyword argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for(@person, as: :client) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with instance variable and url keyword argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for(@post, url: super_posts_path) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with instance variable and format keyword argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for(@post, format: :json) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with instance variable and remote keyword argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for(@post, remote: true) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with data attributes and html options" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for(@post, data: { behavior: "autosave" }, html: { name: "go" }) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with namespaced route" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for([:admin, @post]) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with resource associations route" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for([@document, @comment]) do |f| %>
        <% end %>
      HTML
    end

    test "form_for with local variable" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for post do |f| %>
        <% end %>
      HTML
    end

    test "form_for with url and authenticity_token" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for @invoice, url: external_url, authenticity_token: 'external_token' do |f| %>
        <% end %>
      HTML
    end

    test "form_for with all options" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_for @post, as: :post, url: post_path(@post), method: :patch, html: { class: "edit_post", id: "edit_post_45" } do |f| %>
        <% end %>
      HTML
    end
  end
end
