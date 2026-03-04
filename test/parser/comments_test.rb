# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class CommentsTest < Minitest::Spec
    include SnapshotUtils

    test "HTML comment with padding whitespace" do
      assert_parsed_snapshot(%(<!-- Hello World -->))
    end

    test "HTML comment with no whitespace" do
      assert_parsed_snapshot(%(<!--Hello World-->))
    end

    test "HTML comment followed by html tag" do
      assert_parsed_snapshot(%(<!--Hello World--><h1>Hello</h1>))
    end

    test "HTML comment followed by html tag with nested comment" do
      assert_parsed_snapshot(%(
        <!--Hello World-->
        <h1><!-- Hello World --></h1>
      ))
    end

    test "HTML comment with if" do
      assert_parsed_snapshot(<<~HTML)
        <!--
          <% if Rails.env.development? %>
            Debug info: <%= current_user&.email %>
          <% end %>
        -->
      HTML
    end

    test "HTML comment with invalid closing tag --!>" do
      assert_parsed_snapshot(%(<!-- Hello World --!>))
    end

    test "HTML comment with invalid closing tag --!> no whitespace" do
      assert_parsed_snapshot(%(<!--Hello World--!>))
    end

    test "HTML comment with invalid closing tag --!> followed by html tag" do
      assert_parsed_snapshot(%(<!--Hello World--!><h1>Hello</h1>))
    end
  end
end
