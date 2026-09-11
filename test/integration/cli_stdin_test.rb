# frozen_string_literal: true

require "English"
require_relative "../test_helper"
require_relative "../snapshot_utils"

require "tempfile"
require "json"

module Engine
  class CLIStdinTest < Minitest::Spec
    include SnapshotUtils

    def setup
      skip "Shell stdin tests are skipped in CI" if ENV["CI"]
    end

    def with_temp_file(content)
      file = Tempfile.new(["test_template", ".erb"])
      file.write(content)
      file.close
      yield file.path
    ensure
      file&.unlink
    end

    test "shell: lex accepts piped stdin" do
      output = `echo '<div>Hello</div>' | exe/herb lex`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "TOKEN_HTML_TAG_START"
      assert_includes output, "div"

      assert_snapshot_matches(output, "cli_stdin_test-0")
    end

    test "shell: parse accepts piped stdin" do
      output = `echo '<div>Hello</div>' | exe/herb parse`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "DocumentNode"
      assert_includes output, "HTMLElementNode"

      assert_snapshot_matches(output, "cli_stdin_test-1")
    end

    test "shell: compile accepts piped stdin" do
      output = `echo '<div><%= name %></div>' | exe/herb compile`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "_buf = ::String.new"
      assert_includes output, "__herb.h((name))"

      assert_snapshot_matches(output, "cli_stdin_test-2")
    end

    test "shell: ruby accepts piped stdin" do
      output = `echo '<div><%= user.name %></div>' | exe/herb ruby`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "user.name"

      assert_snapshot_matches(output, "cli_stdin_test-3")
    end

    test "shell: html accepts piped stdin" do
      output = `echo '<div><%= user.name %></div>' | exe/herb html`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "<div>"
      assert_includes output, "</div>"

      assert_snapshot_matches(output, "cli_stdin_test-4")
    end

    test "shell: render accepts piped stdin" do
      output = `echo '<div>Static</div>' | exe/herb render`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "<div>Static</div>"

      assert_snapshot_matches(output, "cli_stdin_test-5")
    end

    test "shell: compile with json flag and stdin" do
      output = `echo '<div>Test</div>' | exe/herb compile --json`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      json_data = JSON.parse(output)
      assert_equal true, json_data["success"]
      assert_includes json_data["source"], "_buf = ::String.new"

      assert_snapshot_matches(json_data["source"], "cli_stdin_test-6")
    end

    test "shell: lex with json flag and stdin" do
      output = `echo '<div>Test</div>' | exe/herb lex --json`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      json_data = JSON.parse(output)
      assert_kind_of Array, json_data
      assert(json_data.any? { |token| token["type"] == "TOKEN_HTML_TAG_START" })
    end

    test "shell: compile with multiple flags and stdin" do
      output = `echo '<div><%= x %></div>' | exe/herb compile --no-escape --freeze`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "# frozen_string_literal: true"
      assert_includes output, "(x).to_s"

      assert_snapshot_matches(output, "cli_stdin_test-7")
    end

    test "shell: stdin with file redirection and dash" do
      with_temp_file("<article>Content</article>") do |file_path|
        output = `exe/herb lex - < #{file_path}`

        assert $CHILD_STATUS.success?, "Command failed with: #{output}"
        assert_includes output, "TOKEN_HTML_TAG_START"
        assert_includes output, "article"

        assert_snapshot_matches(output, "cli_stdin_test-8")
      end
    end

    test "shell: cat pipe to lex" do
      with_temp_file("<section>Data</section>") do |file_path|
        output = `cat #{file_path} | exe/herb lex`

        assert $CHILD_STATUS.success?, "Command failed with: #{output}"
        assert_includes output, "TOKEN_HTML_TAG_START"
        assert_includes output, "section"

        assert_snapshot_matches(output, "cli_stdin_test-9")
      end
    end
  end
end
