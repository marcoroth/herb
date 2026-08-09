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

    test "trailing comment in output tag" do
      template = %(<%= value # this is a comment %>)

      assert_compiled_snapshot(template)
    end

    test "trailing comment in output tag with method call" do
      template = %(<%= helper_method arg1, arg2 # trailing comment %>)

      assert_compiled_snapshot(template)
    end

    test "evaluation: trailing comment in output tag" do
      template = %(<%= value # this is a comment %>)

      assert_evaluated_snapshot(template, { value: "Hello World" })
    end

    test "evaluation: trailing comment in output tag with debug mode" do
      template = %(<%= value # this is a comment %>)

      assert_evaluated_snapshot(template, { value: "Hello World" }, debug: true)
    end

    test "trailing comment in escaped output tag" do
      template = %(<%== value # this is a comment %>)

      assert_compiled_snapshot(template)
    end

    test "evaluation: trailing comment in escaped output tag" do
      template = %(<%== value # this is a comment %>)

      assert_evaluated_snapshot(template, { value: "<b>Hello</b>" })
    end

    test "evaluation: standalone erb comment trims trailing newline" do
      template = "<%# comment %>\n"

      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "evaluation: erb comment before code trims trailing newline" do
      template = "<%# comment %>\n<% if true %>content<% end %>"

      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "evaluation: multiple erb comments trim trailing newlines" do
      template = "<%# comment1 %>\n<%# comment2 %>\n"

      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "erb comment lines preserve line count parity with erubi" do
      template = "<%# comment 1 %>\n<%# comment 2 %>\n<% code = 1 %>\n<%= code %>"

      herb_engine = assert_compiled_snapshot(template)
      require "erubi"
      erubi_engine = Erubi::Engine.new(template)

      assert_equal(
        erubi_engine.src.lines.count, herb_engine.src.lines.count,
        "Herb should emit a blank line for each ERB comment to preserve line numbering.\n  " \
        "Erubi (#{erubi_engine.src.lines.count} lines): #{erubi_engine.src.inspect}\n  " \
        "Herb  (#{herb_engine.src.lines.count} lines): #{herb_engine.src.inspect}"
      )
    end
  end
end
