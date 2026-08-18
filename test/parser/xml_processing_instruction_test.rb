# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class XMLProcessingInstructionTest < Minitest::Spec
    include SnapshotUtils

    test "processing instruction without data" do
      assert_parsed_snapshot("<?end>")
    end

    test "processing instruction with data" do
      assert_parsed_snapshot("<?marker name=\"placeholder\">")
    end

    test "processing instruction closed with question mark" do
      assert_parsed_snapshot("<?marker name=\"placeholder\"?>")
    end

    test "processing instruction with dashed target" do
      assert_parsed_snapshot("<?xml-stylesheet type=\"text/xsl\" href=\"style.xsl\"?>")
    end

    test "processing instruction with colon in target" do
      assert_parsed_snapshot("<?soap:envelope?>")
    end

    test "processing instruction with erb content" do
      assert_parsed_snapshot("<?marker name=\"<%= placeholder_name %>\">")
    end

    test "processing instruction inside element" do
      assert_parsed_snapshot("<div>\n  <?marker name=\"placeholder\">\n</div>")
    end

    test "processing instructions surrounding content" do
      assert_parsed_snapshot("<div>\n  <?start name=\"another-placeholder\">\n    Loading\n  <?end>\n</div>")
    end

    test "processing instruction after text content" do
      assert_parsed_snapshot("Hello <?marker name=\"placeholder\"> World")
    end

    test "two processing instructions" do
      assert_parsed_snapshot("<?start name=\"a\"><?end>")
    end

    test "unterminated processing instruction" do
      assert_parsed_snapshot("<?marker")
    end

    test "question mark without target is not a processing instruction" do
      assert_parsed_snapshot("<? not a processing instruction>")
    end

    test "xml declaration is not a processing instruction" do
      assert_parsed_snapshot("<?xml version=\"1.0\"?>")
    end
  end
end
