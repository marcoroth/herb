# frozen_string_literal: true

require "English"
require_relative "../test_helper"

require "tempfile"
require "json"

module Engine
  class CLIStdinTest < Minitest::Spec
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
      output = `echo '<div>Hello</div>' | exe/herb lex 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "TOKEN_HTML_TAG_START"
      assert_includes output, "div"
    end

    test "shell: parse accepts piped stdin" do
      output = `echo '<div>Hello</div>' | exe/herb parse 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "DocumentNode"
      assert_includes output, "HTMLElementNode"
    end

    test "shell: compile accepts piped stdin" do
      output = `echo '<div><%= name %></div>' | exe/herb compile 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "_buf = ::String.new"
      assert_includes output, "__herb.h((name))"
    end

    test "shell: ruby accepts piped stdin" do
      output = `echo '<div><%= user.name %></div>' | exe/herb ruby 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "user.name"
    end

    test "shell: html accepts piped stdin" do
      output = `echo '<div><%= user.name %></div>' | exe/herb html 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "<div>"
      assert_includes output, "</div>"
    end

    test "shell: render accepts piped stdin" do
      output = `echo '<div>Static</div>' | exe/herb render 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "<div>Static</div>"
    end

    test "shell: compile with json flag and stdin" do
      output = `echo '<div>Test</div>' | exe/herb compile --json 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      json_data = JSON.parse(output)
      assert_equal true, json_data["success"]
      assert_includes json_data["source"], "_buf = ::String.new"
    end

    test "shell: lex with json flag and stdin" do
      output = `echo '<div>Test</div>' | exe/herb lex --json 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      json_data = JSON.parse(output)
      assert_kind_of Array, json_data
      assert(json_data.any? { |token| token["type"] == "TOKEN_HTML_TAG_START" })
    end

    test "shell: compile with multiple flags and stdin" do
      output = `echo '<div><%= x %></div>' | exe/herb compile --no-escape --freeze 2>&1`

      assert $CHILD_STATUS.success?, "Command failed with: #{output}"
      assert_includes output, "# frozen_string_literal: true"
      assert_includes output, "(x).to_s"
    end

    test "shell: stdin with file redirection and dash" do
      with_temp_file("<article>Content</article>") do |file_path|
        output = `exe/herb lex - < #{file_path} 2>&1`

        assert $CHILD_STATUS.success?, "Command failed with: #{output}"
        assert_includes output, "TOKEN_HTML_TAG_START"
        assert_includes output, "article"
      end
    end

    test "shell: cat pipe to lex" do
      with_temp_file("<section>Data</section>") do |file_path|
        output = `cat #{file_path} | exe/herb lex 2>&1`

        assert $CHILD_STATUS.success?, "Command failed with: #{output}"
        assert_includes output, "TOKEN_HTML_TAG_START"
        assert_includes output, "section"
      end
    end
  end
end
