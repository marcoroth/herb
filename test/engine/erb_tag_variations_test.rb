# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class ERBTagVariationsTest < Minitest::Spec
    include SnapshotUtils

    test "<% code %>" do
      assert_compiled_snapshot('<% x = 1 %><%= x %>')
      assert_evaluated_snapshot('<% x = 1 %><%= x %>')
    end

    test "<%= expression %>" do
      assert_compiled_snapshot('<%= value %>')
      assert_evaluated_snapshot('<%= value %>', { value: "hello" })
    end

    test "<%== expression %>" do
      assert_compiled_snapshot('<%== value %>')
      assert_evaluated_snapshot('<%== value %>', { value: "<b>bold</b>" })
    end

    test "<%== expression %> with escape" do
      assert_compiled_snapshot('<%== value %>', escape: true)
      assert_evaluated_snapshot('<%== value %>', { value: "<b>bold</b>" }, escape: true)
    end

    test "<%- code %>" do
      assert_compiled_snapshot("  <%- x = 1 %>\n<%= x %>")
      assert_evaluated_snapshot("  <%- x = 1 %>\n<%= x %>")
    end

    test "<% code -%>" do
      assert_compiled_snapshot("<% x = 1 -%>\n<%= x %>")
      assert_evaluated_snapshot("<% x = 1 -%>\n<%= x %>")
    end

    test "<%graphql %>" do
      assert_compiled_snapshot('<%graphql query { users { id } } %>')
      assert_evaluated_snapshot('<%graphql query { users { id } } %>')
    end

    test "<%graphql %> multiline" do
      template = <<~ERB
        <%graphql
          fragment UserFragment on User {
            name
          }
        %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template)
    end

    test "<%# comment %>" do
      assert_compiled_snapshot('<%# this is a comment %>')
      assert_evaluated_snapshot('<%# this is a comment %>')
    end

    test "<%#= expression %>" do
      assert_compiled_snapshot('<%#= render "partial" %>')
      assert_evaluated_snapshot('<%#= render "partial" %>')
    end

    test "<%#= expression %> with surrounding code" do
      template = <<~ERB
        <div>
          <%#= render "partial" %>
          <p>Visible content</p>
        </div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template)
    end

    test "<%# = expression %>" do
      assert_compiled_snapshot('<%# = render "partial" %>')
      assert_evaluated_snapshot('<%# = render "partial" %>')
    end

    test "<%#== expression %>" do
      assert_compiled_snapshot('<%#== raw_html %>')
      assert_evaluated_snapshot('<%#== raw_html %>')
    end

    test "<%# == expression %>" do
      assert_compiled_snapshot('<%# == raw_html %>')
      assert_evaluated_snapshot('<%# == raw_html %>')
    end

    test "<%#- code %>" do
      assert_compiled_snapshot('<%#- x = 1 %>')
      assert_evaluated_snapshot('<%#- x = 1 %>')
    end

    test "<%# - code %>" do
      assert_compiled_snapshot('<%# - x = 1 %>')
      assert_evaluated_snapshot('<%# - x = 1 %>')
    end

    test "<%#graphql %>" do
      assert_compiled_snapshot('<%#graphql query { users { id } } %>')
      assert_evaluated_snapshot('<%#graphql query { users { id } } %>')
    end

    test "<%# graphql %>" do
      assert_compiled_snapshot('<%# graphql query { users { id } } %>')
      assert_evaluated_snapshot('<%# graphql query { users { id } } %>')
    end

    test "<%#% code %>" do
      assert_compiled_snapshot('<%#% code %>')
      assert_evaluated_snapshot('<%#% code %>')
    end

    test "<%# % code %>" do
      assert_compiled_snapshot('<%# % code %>')
      assert_evaluated_snapshot('<%# % code %>')
    end

    test "<%#%= expression %>" do
      assert_compiled_snapshot('<%#%= expression %>')
      assert_evaluated_snapshot('<%#%= expression %>')
    end

    test "<%# %= expression %>" do
      assert_compiled_snapshot('<%# %= expression %>')
      assert_evaluated_snapshot('<%# %= expression %>')
    end

    test "mixed commented and active tags" do
      template = <<~ERB
        <div>
          <%#= render "disabled_partial" %>
          <%= value %>
          <%# this is a comment %>
          <%#== raw_disabled %>
          <p>Content</p>
        </div>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, { value: "hello" })
    end

    test "all commented tag variations" do
      template = <<~ERB
        <%# regular comment %>
        <%#= commented output %>
        <%#== commented raw output %>
        <%#- commented trim %>
        <%#graphql query { user { id } } %>
        <p>Visible</p>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template)
    end

    test "all linter-formatted commented tag variations" do
      template = <<~ERB
        <%# regular comment %>
        <%# = commented output %>
        <%# == commented raw output %>
        <%# - commented trim %>
        <%# graphql query { user { id } } %>
        <p>Visible</p>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template)
    end
  end
end
