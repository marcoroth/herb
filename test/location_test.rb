# frozen_string_literal: true

require_relative "test_helper"

class LocationTest < Minitest::Spec
  test ".zero returns a fresh zero-valued location" do
    location = Herb::Location.zero

    assert_equal(
      { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
      location.to_hash
    )

    refute_same location.start, location.end
    refute_same location, Herb::Location.zero
  end
end
