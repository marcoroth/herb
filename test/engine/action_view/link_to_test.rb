# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class LinkToTest < Minitest::Spec
      include ActionViewTestHelper

      Profile = Data.define(:id, :name) do
        def to_s = "/profiles/#{id}"
        def model_name = "Profile"
      end

      test "link_to with text and url" do
        assert_precompiled_snapshot('<%= link_to "Click me", "#" %>')
      end

      test "link_to with html options" do
        assert_precompiled_snapshot('<%= link_to "Click me", "#", class: "example" %>')
      end

      test "link_to with block" do
        assert_precompiled_snapshot('<%= link_to "#" do %>Click me<% end %>')
      end

      test "link_to with block and class" do
        assert_precompiled_snapshot('<%= link_to "#", class: "btn" do %>Click me<% end %>')
      end

      test "link_to with :back" do
        assert_precompiled_snapshot('<%= link_to "Back", :back %>')
      end

      test "link_to with inline block" do
        assert_precompiled_snapshot('<%= link_to("#") { "Click me" } %>')
      end

      test "link_to with inline block and attributes" do
        assert_precompiled_snapshot('<%= link_to("/about", class: "btn") { "About" } %>')
      end

      test "link_to with path helper" do
        assert_precompiled_snapshot(
          '<%= link_to "Click me", root_path %>',
          { root_path: "/home" }
        )
      end

      test "link_to with model" do
        assert_precompiled_snapshot(
          "<%= link_to @profile %>",
          { "@profile": Profile.new(id: 42, name: "Alice") }
        )
      end

      test "link_to with inline block and ruby expression" do
        assert_precompiled_snapshot(
          '<%= link_to("#") { @user_name } %>',
          { "@user_name": "Alice" }
        )
      end

      test "link_to with block containing HTML and object method call" do
        assert_precompiled_snapshot(<<~ERB, { "@profile": Profile.new(id: 100, name: "Alice") })
          <%= link_to @profile do %>
            <strong><%= @profile.name %></strong> -- <span>Check it out!</span>
          <% end %>
        ERB
      end

    end
  end
end
