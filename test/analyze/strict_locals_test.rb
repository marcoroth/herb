# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class StrictLocalsTest < Minitest::Spec
    include SnapshotUtils

    test "empty locals" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: () %>
      HTML
    end

    test "empty locals with whitespace trimming" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: () -%>
      HTML
    end

    test "single required local" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:) %>
      HTML
    end

    test "single required local with whitespace trimming" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:) -%>
      HTML
    end

    test "multiple required locals" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (article:, theme:) %>
      HTML
    end

    test "single optional local with string default" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message: "Hello, world!") %>
      HTML
    end

    test "single optional local with string default and whitespace trimming" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message: "Hello, world!") -%>
      HTML
    end

    test "optional local with symbol default" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (theme: :light) %>
      HTML
    end

    test "optional local with boolean default" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (admin: false) %>
      HTML
    end

    test "optional local with nil default" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (user: nil) %>
      HTML
    end

    test "optional local with integer default" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (count: 0) %>
      HTML
    end

    test "required and optional locals" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (article:, theme: "light") -%>
      HTML
    end

    test "multiple locals mixed" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (user:, admin: false) %>
      HTML
    end

    test "double-splat only" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (**attributes) %>
      HTML
    end

    test "optional local with double-splat" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message: "Hello, world!", **attributes) -%>
      HTML
    end

    test "required local with double-splat" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:, **attributes) %>
      HTML
    end

    test "reserved keyword name as local" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (class: "message") %>
      HTML
    end

    test "strict locals at top of partial with content below" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:) -%>
        <%= message %>
      HTML
    end

    test "strict locals not at top of file" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <div class="card">
          <%# locals: (user:) %>
          <%= user.name %>
        </div>
      HTML
    end

    test "regular ERB comment is not transformed" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# This is just a regular comment %>
      HTML
    end

    test "ERB comment that looks similar but is not strict locals" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# local_assigns[:user] %>
      HTML
    end

    test "strict locals comment without option enabled stays as ERBContentNode" do
      assert_parsed_snapshot(<<~HTML)
        <%# locals: (message:) %>
      HTML
    end

    test "single positional argument produces an error" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message) %>
      HTML
    end

    test "multiple positional arguments produce errors" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (user, admin) %>
      HTML
    end

    test "mixed positional and keyword arguments produce error for positional" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (user, theme:) %>
      HTML
    end

    test "block argument produces an error" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (&block) %>
      HTML
    end

    test "block argument with keyword produces error for block" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:, &block) %>
      HTML
    end

    test "splat argument produces an error" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (*args) %>
      HTML
    end

    test "splat argument with keyword produces error for splat" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:, *args) %>
      HTML
    end

    test "unbalanced parentheses produces errors" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message: %>
      HTML
    end

    test "invalid ruby syntax inside parens produces errors" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (!!!) %>
      HTML
    end

    test "missing opening parenthesis produces empty locals" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: message: %>
      HTML
    end

    test "unterminated string default value produces errors" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message: "Hello, world!) %>
      HTML
    end

    test "missing comma between locals produces errors" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message: "Hello" theme: :light) %>
      HTML
    end

    test "positional with assignment produces an error" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (name = "World") %>
      HTML
    end

    test "no space between # and locals keyword" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%#locals: (user:) %>
      HTML
    end

    test "expression tag with ruby comment is not transformed" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <% # locals: (user:) %>
      HTML
    end

    test "multiple double-splats produce errors" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (**attributes, **more) %>
      HTML
    end

    test "two strict locals declarations in the same document" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message:) %>
        <%# locals: (user:) %>
      HTML
    end

    test "positional with optional keyword produces error for positional only" do
      assert_parsed_snapshot(<<~HTML, strict_locals: true)
        <%# locals: (message, something: "else") %>
      HTML
    end
  end
end
