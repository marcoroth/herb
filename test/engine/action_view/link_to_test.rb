# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class LinkToTest < Minitest::Spec
      include ActionViewTestHelper

      test "link_to with text and url" do
        assert_action_view_helper('<%= link_to "Click me", "#" %>')
      end

      test "link_to with html options" do
        assert_action_view_helper('<%= link_to "Click me", "#", class: "example" %>')
      end

      test "link_to with block" do
        assert_action_view_helper('<%= link_to "#" do %>Click me<% end %>')
      end

      test "link_to with block and class" do
        assert_action_view_helper('<%= link_to "#", class: "btn" do %>Click me<% end %>')
      end

      test "link_to with :back" do
        assert_action_view_helper('<%= link_to "Back", :back %>')
      end

      test "link_to with inline block" do
        assert_action_view_helper('<%= link_to("#") { "Click me" } %>')
      end

      test "link_to with inline block and attributes" do
        assert_action_view_helper('<%= link_to("/about", class: "btn") { "About" } %>')
      end
    end
  end
end
