# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class HTMLEntitiesTest < Minitest::Spec
    include SnapshotUtils

    test "&lt;" do
      assert_lexed_snapshot("&lt;")
    end

    test "&gt;" do
      assert_lexed_snapshot("&gt;")
    end

    test "&nbsp;" do
      assert_lexed_snapshot("&nbsp;")
    end

    test "&quot;" do
      assert_lexed_snapshot("&quot;")
    end

    test "&apos;" do
      assert_lexed_snapshot("&apos;")
    end

    test "ampersand" do
      assert_lexed_snapshot("&amp;")
    end

    test "literal ampersand" do
      assert_lexed_snapshot("&")
    end
  end
end
