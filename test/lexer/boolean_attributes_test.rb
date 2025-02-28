# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class BooleanAttributesTest < Minitest::Spec
    include SnapshotUtils

    test "boolean attribute" do
      assert_lexed_snapshot("<img required />")
    end

    test "boolean attribute without whitespace and with self-closing tag" do
      assert_lexed_snapshot("<img required/>")
    end

    test "boolean attribute without whitespace and without self-closing tag" do
      assert_lexed_snapshot("<img required>")
    end
  end
end
