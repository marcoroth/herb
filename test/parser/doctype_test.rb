# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class DoctypeTest < Minitest::Spec
    include SnapshotUtils

    test "doctype" do
      assert_parsed_snapshot("<!DOCTYPE>")
    end

    test "doctype with space" do
      assert_parsed_snapshot("<!DOCTYPE >")
    end

    test "doctype with html" do
      assert_parsed_snapshot("<!DOCTYPE html>")
    end

    test "two doctypes" do
      assert_parsed_snapshot("<!DOCTYPE html><!DOCTYPE html>")
    end

    test "html4 doctype" do
      assert_parsed_snapshot(%(<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">))
    end
  end
end
