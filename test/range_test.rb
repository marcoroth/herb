# frozen_string_literal: true

require_relative "test_helper"

class RangeTest < Minitest::Spec
  test ".zero returns a fresh zero-valued range" do
    range = Herb::Range.zero

    assert_equal [0, 0], range.to_a
    refute_same range, Herb::Range.zero
  end
end
