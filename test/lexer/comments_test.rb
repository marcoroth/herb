# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class CommentsTest < Minitest::Spec
    include SnapshotUtils

    test "HTML comment with padding whitespace" do
      assert_lexed_snapshot(%(<!-- Hello World -->))
    end

    test "HTML comment with no whitespace" do
      assert_lexed_snapshot(%(<!--Hello World-->))
    end

    test "HTML comment followed by html tag" do
      assert_lexed_snapshot(%(<!--Hello World--><h1>Hello</h1>))
    end

    test "HTML comment followed by html tag with nested comment" do
      assert_lexed_snapshot(%(
        <!--Hello World-->
        <h1><!-- Hello World --></h1>
      ))
    end
  end
end
