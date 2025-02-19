# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class DoctypeTest < Minitest::Spec
    include SnapshotUtils

    test "doctype" do
      assert_lexed_snapshot("<!DOCTYPE>")
    end

    test "doctype with space" do
      assert_lexed_snapshot("<!DOCTYPE >")
    end

    test "doctype with html" do
      assert_lexed_snapshot("<!DOCTYPE html>")
    end

    test "html4 doctype" do
      assert_lexed_snapshot(%(<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">))
    end

    test "doctype case insensitivity" do
      doctypes = ["<!doctype>", "<!DoCtYpE>", "<!dOcTyPe>"]
      doctypes.each do |doctype|
        assert_lexed_snapshot(doctype)
      end
    end
  end
end
