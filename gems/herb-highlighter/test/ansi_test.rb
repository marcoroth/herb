# frozen_string_literal: true

require "test_helper"

class AnsiTest < Minitest::Test
  def test_strips_ansi_sequences
    assert_equal "Admin", Herb::Highlighter.strip_ansi("\e[31mAdmin\e[0m")
    assert_equal "plain", Herb::Highlighter.strip_ansi("plain")
  end

  def test_measures_visible_width
    assert_equal 5, Herb::Highlighter.visible_width("\e[31mAdmin\e[0m")
    assert_equal 0, Herb::Highlighter.visible_width("")
  end

  def test_highlighted_output_is_wider_than_its_visible_text
    output = Herb::Highlighter.new.highlight("<div></div>", show_line_numbers: false)

    assert_operator output.length, :>, Herb::Highlighter.strip_ansi(output).length
  end
end
