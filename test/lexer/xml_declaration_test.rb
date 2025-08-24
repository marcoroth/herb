# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class XMLDeclarationTest < Minitest::Spec
    include SnapshotUtils

    test "basic xml declaration" do
      assert_lexed_snapshot("<?xml version=\"1.0\" ?>")
    end

    test "xml declaration with encoding" do
      assert_lexed_snapshot("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
    end

    test "xml declaration with encoding ISO-8859-1" do
      assert_lexed_snapshot("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>")
    end

    test "xml declaration with standalone" do
      assert_lexed_snapshot("<?xml version=\"1.0\" standalone=\"yes\"?>")
    end

    test "xml declaration with all attributes" do
      assert_lexed_snapshot("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
    end

    test "xml declaration case insensitive 1" do
      assert_lexed_snapshot("<?xml version=\"1.0\"?>")
    end

    test "xml declaration case insensitive 2" do
      assert_lexed_snapshot("<?XML version=\"1.0\"?>")
    end

    test "xml declaration case insensitive 3" do
      assert_lexed_snapshot("<?Xml version=\"1.0\"?>")
    end

    test "xml declaration with spaces" do
      assert_lexed_snapshot("<?xml  version = \"1.0\"  ?>")
    end

    test "xml declaration with newlines" do
      assert_lexed_snapshot("<?xml version=\"1.0\"\n      encoding=\"UTF-8\"?>")
    end

    test "xml declaration with single quotes" do
      assert_lexed_snapshot("<?xml version='1.0' encoding='UTF-8'?>")
    end

    test "xml declaration followed by html" do
      assert_lexed_snapshot("<?xml version=\"1.0\"?>\n<html><body>Hello</body></html>")
    end
  end
end
