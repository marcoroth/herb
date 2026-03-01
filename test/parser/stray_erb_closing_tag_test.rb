# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class StrayERBClosingTagTest < Minitest::Spec
    include SnapshotUtils

    test "stray %> in open tag after unquoted ERB attribute value" do
      template = <<~HTML
        <div id=<%= dom_id(@slot) %> %>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "stray %> in open tag after quoted ERB attribute value" do
      template = <<~HTML
        <div id="<%= dom_id(@slot) %>" %>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "stray %> in open tag with no preceding ERB tag" do
      template = <<~HTML
        <div %>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "stray %> at document top level" do
      template = <<~HTML
        hello %> world
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "stray %> at document top level after ERB tag" do
      template = <<~HTML
        <% content %> %>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "%> inside quoted attribute value is not stray" do
      template = <<~HTML
        <div class="foo %> bar">hello</div>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "multiple stray %> in open tag" do
      template = <<~HTML
        <div %> %>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end

    test "stray %> between attributes in open tag" do
      template = <<~HTML
        <div class="foo" %> id="bar"></div>
      HTML

      assert_parsed_snapshot(template, strict: true)
      assert_parsed_snapshot(template, strict: false)
    end
  end
end
