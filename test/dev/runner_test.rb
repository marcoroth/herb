# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/dev/runner"
require "fileutils"
require "tmpdir"

module Dev
  class RunnerTest < Minitest::Spec
    class FakeWebSocket
      attr_reader :messages #: Array[Hash[Symbol, untyped]]

      def initialize
        @messages = []
      end

      def client_count
        1
      end

      def broadcast(message)
        @messages << message
      end
    end

    BROKEN = "<div>\n  <form>\n</div>\n" #: String

    def broadcast_for(current_content, previous_content)
      websocket = FakeWebSocket.new
      parse = Herb.parse(current_content, strict: true, analyze: true)

      capture_io do
        Herb::Dev::Runner.new.send(
          :broadcast_errors,
          "/app/views/posts/index.html.erb",
          "app/views/posts/index.html.erb",
          parse,
          current_content,
          previous_content,
          {},
          Set.new,
          websocket,
          "12:00:00"
        )
      end

      websocket.messages.first
    end

    test "names the parser as what found the error, not itself as what delivered it" do
      error = broadcast_for(BROKEN, "")[:errors].first
      parsed = Herb.parse(BROKEN, strict: true, analyze: true).errors.first.to_diagnostic(template: "app/views/posts/index.html.erb")

      assert_equal "Herb Parser", error[:origin]
      assert_equal parsed.origin, error[:origin]
    end

    test "sends the code and suggestion the same error would carry off the page" do
      error = broadcast_for(BROKEN, "")[:errors].first
      parsed = Herb.parse(BROKEN, strict: true, analyze: true).errors.first.to_diagnostic(template: "app/views/posts/index.html.erb")

      assert_equal parsed.code, error[:code]
      assert_equal parsed.suggestion, error[:suggestion]
      assert_equal parsed.message, error[:message]
    end

    test "sends the whole file with the errors, so the panel can highlight it" do
      assert_equal BROKEN, broadcast_for(BROKEN, "")[:source]
    end

    test "sends the content it just read, not the content it replaced" do
      assert_equal BROKEN, broadcast_for(BROKEN, "<div>\n</div>\n")[:source]
    end

    test "text_changed is patchable" do
      diff_result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :text_changed, diff_result.operations[0].type
    end

    test "attribute_value_changed is patchable" do
      diff_result = Herb.diff('<div class="old">Content</div>', '<div class="new">Content</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_value_changed, diff_result.operations[0].type
    end

    test "attribute_added is patchable" do
      diff_result = Herb.diff("<div>Content</div>", '<div id="main">Content</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_added, diff_result.operations[0].type
    end

    test "attribute_removed is patchable" do
      diff_result = Herb.diff('<div id="main">Content</div>', "<div>Content</div>")

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_removed, diff_result.operations[0].type
    end

    test "node_inserted triggers reload" do
      diff_result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "node_removed triggers reload" do
      diff_result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "erb_content_changed triggers reload" do
      diff_result = Herb.diff("<%= foo %>", "<%= bar %>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "inserting ERB node triggers reload" do
      diff_result = Herb.diff("<div>Hello</div>", "<div><%= name %></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "identical templates produce no operations" do
      diff_result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert diff_result.identical?
      assert_equal 0, diff_result.operation_count
    end

    test "multiple patchable operations are all patchable" do
      diff_result = Herb.diff('<div class="old">Hello</div>', '<div class="new">World</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 2, diff_result.operation_count
    end

    test "mixed patchable and non-patchable triggers reload" do
      diff_result = Herb.diff('<div class="old">Hello</div>', '<div class="new">Hello</div><span>New</span>')

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "indexing writes no cursor escapes when stdout is not a terminal" do
      directory = Dir.mktmpdir("herb_dev_runner_test")

      File.write(File.join(directory, "index.html.erb"), "<div>Hello</div>\n")

      config = Herb::Configuration.load(directory)

      output, = capture_io do
        Herb::Dev::Runner.new(path: directory).send(:index_files, config, directory)
      end

      assert_equal "  Files:     1 templates indexed\n", output
    ensure
      FileUtils.rm_rf(directory)
      Herb.reset_configuration!
    end

    test "prints the diagnostic with its source context and suggestion" do
      output, = capture_io do
        Herb::Dev::Runner.new.send(
          :broadcast_errors,
          "/app/views/posts/index.html.erb",
          "app/views/posts/index.html.erb",
          Herb.parse(BROKEN, strict: true, analyze: true),
          BROKEN,
          "",
          {},
          Set.new,
          FakeWebSocket.new,
          "12:00:00"
        )
      end

      expected = [
        "    12:00:00 \u2717 error  \u2718 [MissingClosingTagError] Opening tag `<form>` at (2:3) doesn't have a matching closing tag `</form>` in the same scope.",
        "",
        "      app/views/posts/index.html.erb:2:3:",
        "        2 \u2502   <form>",
        "          \u2575   ~~~~~~",
        "",
        "    Add the closing tag, or make it self-closing.",
        "",
        ""
      ].join("\n")

      assert_equal expected, output
    end

    test "a repeated event for unchanged content reports the error only once" do
      runner = Herb::Dev::Runner.new
      websocket = FakeWebSocket.new
      file_states = { "/app/views/posts/index.html.erb" => "<div>\n</div>\n" }
      errored_files = Set.new
      directory = Dir.mktmpdir("herb_dev_runner_test")
      path = File.join(directory, "index.html.erb")

      File.write(path, BROKEN)
      file_states[path] = "<div>\n</div>\n"

      first, = capture_io do
        runner.send(:handle_file_change, path, "index.html.erb", file_states, errored_files, websocket, "12:00:00", "index.html.erb")
      end

      second, = capture_io do
        runner.send(:handle_file_change, path, "index.html.erb", file_states, errored_files, websocket, "12:00:01", "index.html.erb")
      end

      refute_equal "", first
      assert_equal "", second
    ensure
      FileUtils.rm_rf(directory)
    end

    test "an error already reported is not repeated when a new one joins it" do
      broken_once = "<div>\n  <form>\n</div>\n"
      broken_twice = "<div>\n  <form>\n  <span>\n</div>\n"

      output, = capture_io do
        Herb::Dev::Runner.new.send(
          :broadcast_errors,
          "/app/views/posts/index.html.erb",
          "app/views/posts/index.html.erb",
          Herb.parse(broken_twice, strict: true, analyze: true),
          broken_twice,
          broken_once,
          {},
          Set.new,
          FakeWebSocket.new,
          "12:00:00"
        )
      end

      expected = [
        "    12:00:00 \u2717 error  \u2718 [MissingClosingTagError] Opening tag `<span>` at (3:3) doesn't have a matching closing tag `</span>` in the same scope.",
        "",
        "      app/views/posts/index.html.erb:3:3:",
        "        3 \u2502   <span>",
        "          \u2575   ~~~~~~",
        "",
        "    Add the closing tag, or make it self-closing.",
        "",
        ""
      ].join("\n")

      assert_equal expected, output
    end
  end
end
