# frozen_string_literal: true

require_relative "test_helper"

class PositionTest < Minitest::Spec
  test ".zero returns a fresh zero-valued position" do
    position = Herb::Position.zero

    assert_equal({ line: 0, column: 0 }, position.to_hash)
    refute_same position, Herb::Position.zero
  end
end
