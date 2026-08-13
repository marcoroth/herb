# frozen_string_literal: true

require "test_helper"

class HighlighterTest < Minitest::Test
  def test_highlights_content_with_line_numbers
    output = plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, path: "show.html.erb"))

    assert_includes output, "show.html.erb"
    assert_includes output, "1 │ <% if user.admin? %>"
    assert_includes output, "3 │ <% end %>"
  end

  def test_omits_line_numbers_when_asked
    output = plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, show_line_numbers: false))

    refute_includes output, "1 │"
    assert_includes output, "<% if user.admin? %>"
  end

  def test_focuses_a_single_line_with_context
    output = plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, focus_line: 2, context_lines: 0))

    assert_includes output, "badge.png"
    refute_includes output, "<% end %>"
  end

  def test_highlights_a_file_from_disk
    with_template do |path|
      output = plain(Herb::Highlighter.new.highlight_file(path))

      assert_includes output, "badge.png"
      assert_includes output, File.basename(path)
    end
  end

  def test_raises_when_the_file_cannot_be_read
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight_file("does/not/exist.html.erb")
    end

    assert_includes error.message, "does/not/exist.html.erb"
  end

  def test_class_level_shortcuts
    assert_includes plain(Herb::Highlighter.highlight(TestHelper::TEMPLATE)), "user.admin?"

    with_template do |path|
      assert_includes plain(Herb::Highlighter.highlight_file(path)), "badge.png"
    end
  end

  def test_rejects_unknown_options_and_names_the_valid_ones
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, nope: true)
    end

    assert_includes error.message, "unknown field `nope`"
    assert_includes error.message, "`context_lines`"
    assert_includes error.message, "`show_line_numbers`"
  end

  def test_rejects_an_option_of_the_wrong_type
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, context_lines: "two")
    end

    assert_includes error.message, "invalid type: string"
  end

  def test_exposes_versions
    assert_equal Herb::Highlighter::VERSION, Herb::Highlighter.native_version
  end
end
