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

  describe "#contains?" do
    test "answers for a position inside it" do
      assert Herb::Location[1, 0, 1, 5].contains?(Herb::Position[1, 3])
    end

    test "answers for its own start" do
      assert Herb::Location[1, 0, 1, 5].contains?(Herb::Position[1, 0])
    end

    test "does not answer for its own end" do
      refute Herb::Location[1, 0, 1, 5].contains?(Herb::Position[1, 5])
    end

    test "does not answer for a position before it" do
      refute Herb::Location[1, 2, 1, 5].contains?(Herb::Position[1, 1])
    end

    test "spans lines" do
      location = Herb::Location[1, 4, 3, 2]

      assert location.contains?(Herb::Position[2, 0])
      assert location.contains?(Herb::Position[3, 1])
      refute location.contains?(Herb::Position[3, 2])
      refute location.contains?(Herb::Position[1, 3])
    end
  end

  describe "#covers?" do
    test "answers for a location inside it" do
      assert Herb::Location[1, 0, 3, 0].covers?(Herb::Location[2, 0, 2, 4])
    end

    test "answers for itself" do
      assert Herb::Location[1, 0, 3, 0].covers?(Herb::Location[1, 0, 3, 0])
    end

    test "does not answer for a location that reaches past it" do
      refute Herb::Location[1, 0, 3, 0].covers?(Herb::Location[2, 0, 4, 0])
    end
  end

  describe "#empty?" do
    test "answers for a zero location" do
      assert_predicate Herb::Location.zero, :empty?
    end

    test "answers for any location that starts where it ends" do
      assert_predicate Herb::Location[2, 7, 2, 7], :empty?
    end

    test "does not answer for a location that spans a character" do
      refute_predicate Herb::Location[2, 7, 2, 8], :empty?
    end
  end
end
