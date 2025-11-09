# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class ERBCommentsTest < Minitest::Spec
    include SnapshotUtils

    test "inline ruby comment on same line" do
      template = %(<% if true %><% # Comment here %><% end %>)

      assert_compiled_snapshot(template)
    end

    test "inline ruby comment with newline" do
      template = "<% if true %><% # Comment here %>\n<% end %>"

      assert_compiled_snapshot(template)
    end

    test "inline ruby comment between code" do
      template = %(<% if true %><% # Comment here %><%= "hello" %><% end %>)

      assert_compiled_snapshot(template)
    end

    test "inline ruby comment before and between code" do
      template = %(<% # Comment here %><% if true %><% # Comment here %><%= "hello" %><% end %>)

      assert_compiled_snapshot(template)
    end

    test "inline ruby comment with spaces" do
      template = %(<%  # Comment %> <% code = "test" %><%= code %>)

      assert_compiled_snapshot(template)
    end

    test "inline ruby comment multiline" do
      template = "<% # Comment\nmore %> <% code = \"test\" %><%= code %>"

      assert_compiled_snapshot(template)
    end

    test "evaluation: inline ruby comment on same line" do
      template = %(<% if true %><% # Comment here %><% end %>)

      assert_evaluated_snapshot(template)
    end

    test "evaluation: inline ruby comment with newline" do
      template = "<% if true %><% # Comment here %>\n<% end %>"

      assert_evaluated_snapshot(template)
    end

    test "evaluation: inline ruby comment between code" do
      template = %(<% if true %><% # Comment here %><%= "hello" %><% end %>)

      assert_evaluated_snapshot(template)
    end

    test "evaluation: inline ruby comment before and between code" do
      template = %(<% # Comment here %><% if true %><% # Comment here %><%= "hello" %><% end %>)

      assert_evaluated_snapshot(template)
    end

    test "evaluation: inline ruby comment with spaces" do
      template = %(<%  # Comment %> <% code = "test" %><%= code %>)

      assert_evaluated_snapshot(template)
    end

    test "evaluation: inline ruby comment multiline" do
      template = "<% # Comment\nmore %> <% code = \"test\" %><%= code %>"

      assert_evaluated_snapshot(template, { more: "ignored" })
    end
  end
end
