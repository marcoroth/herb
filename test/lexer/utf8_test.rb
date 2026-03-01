# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class Utf8Test < Minitest::Spec
    include SnapshotUtils

    test "single UTF-8 character - a-umlaut (2 bytes)" do
      assert_lexed_snapshot("ä")
    end

    test "single UTF-8 character - euro sign (3 bytes)" do
      assert_lexed_snapshot("€")
    end

    test "single UTF-8 character - emoji (4 bytes)" do
      assert_lexed_snapshot("🌿")
    end

    test "multiple UTF-8 characters" do
      assert_lexed_snapshot("äöü")
    end

    test "mixed ASCII and UTF-8" do
      assert_lexed_snapshot("Hello ä World")
    end

    test "UTF-8 in HTML tag" do
      assert_lexed_snapshot("<div>ä</div>")
    end

    test "UTF-8 in attribute value" do
      assert_lexed_snapshot('<div title="Münchën">content</div>')
    end

    test "non-breaking space (should use TOKEN_NBSP)" do
      assert_lexed_snapshot(" ")
    end

    test "various Unicode symbols" do
      assert_lexed_snapshot("▌►◄▲▼")
    end

    test "emoji sequence" do
      assert_lexed_snapshot("🌿🔥💧⚡")
    end

    test "Chinese characters" do
      assert_lexed_snapshot("你好世界")
    end

    test "Arabic text" do
      assert_lexed_snapshot("مرحبا")
    end

    test "mixed UTF-8 with HTML structure" do
      assert_lexed_snapshot('<h1 title="Café">Björk & Frédéric</h1>')
    end

    test "UTF-8 line breaks and positioning" do
      assert_lexed_snapshot("ä\nö\nü")
    end

    test "complex UTF-8 with ERB" do
      assert_lexed_snapshot('<%= "Héllö #{wörld}" %>')
    end
  end
end
