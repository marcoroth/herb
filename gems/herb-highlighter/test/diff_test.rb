# frozen_string_literal: true

require "test_helper"

class DiffTest < Minitest::Test
  ORIGINAL = %(<span class='card'>\n)
  MODIFIED = %(<span class="card">\n)

  def test_renders_a_diff_between_two_sources
    output = plain(Herb::Highlighter.new.highlight_diff(ORIGINAL, MODIFIED, path: "card.html.erb"))

    assert_includes output, "card.html.erb"
    assert_includes output, "- "
    assert_includes output, "+ "
    assert_includes output, %(<span class='card'>)
    assert_includes output, %(<span class="card">)
  end

  def test_indents_the_diff
    highlighter = Herb::Highlighter.new

    plain_lines = plain(highlighter.highlight_diff(ORIGINAL, MODIFIED)).lines
    indented_lines = plain(highlighter.highlight_diff(ORIGINAL, MODIFIED, indent: "    ")).lines

    assert_equal plain_lines.size, indented_lines.size

    plain_lines.zip(indented_lines).each do |plain_line, indented_line|
      assert_equal "    #{plain_line}", indented_line
    end
  end

  def test_accepts_the_style_enums
    highlighter = Herb::Highlighter.new

    [:tint, :dim, :none].each do |style|
      assert_includes plain(highlighter.highlight_diff(ORIGINAL, MODIFIED, removed_line_style: style)), "card"
    end

    [:split, :inline, :auto].each do |style|
      assert_includes plain(highlighter.highlight_diff(ORIGINAL, MODIFIED, single_line_style: style)), "card"
    end

    [:unified, :split].each do |layout|
      assert_includes plain(highlighter.highlight_diff(ORIGINAL, MODIFIED, layout: layout)), "card"
    end
  end

  def test_rejects_an_unknown_style_and_names_the_valid_ones
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight_diff(ORIGINAL, MODIFIED, removed_line_style: :sparkle)
    end

    assert_includes error.message, "unknown variant `sparkle`"
    assert_includes error.message, "`tint`, `dim`, `none`"
  end

  def test_renders_hunks_without_their_sources
    hunks = [
      {
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 1,
        lines: [
          { type: "removed", content: %(<span class='card'>), oldLineNumber: 1, newLineNumber: nil },
          { type: "added", content: %(<span class="card">), oldLineNumber: nil, newLineNumber: 1 }
        ],
      }
    ]

    output = plain(Herb::Highlighter.new.highlight_diff_hunks(hunks, path: "card.html.erb"))

    assert_includes output, %(<span class='card'>)
    assert_includes output, %(<span class="card">)
  end

  def test_raises_on_malformed_hunks
    assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight_diff_hunks([{ nope: true }])
    end
  end
end
