# frozen_string_literal: true

require_relative "test_helper"

class PositionTest < Minitest::Spec
  test ".zero returns a fresh zero-valued position" do
    position = Herb::Position.zero

    assert_equal({ line: 0, column: 0 }, position.to_hash)
    refute_same position, Herb::Position.zero
  end

  describe "#to_one_based" do
    test "counts the column from one, the way an editor does" do
      assert_equal({ line: 3, column: 1 }, Herb::Position.new(3, 0).to_one_based)
      assert_equal({ line: 3, column: 9 }, Herb::Position.new(3, 8).to_one_based)
    end

    test "never reports a line before the first one" do
      assert_equal({ line: 1, column: 1 }, Herb::Position.zero.to_one_based)
    end

    test "leaves the zero-based serialization alone" do
      position = Herb::Position.new(3, 8)

      assert_equal({ line: 3, column: 8 }, position.to_hash)
      assert_equal({ line: 3, column: 8 }, JSON.parse(position.to_json, symbolize_names: true))
    end
  end

  describe "comparison" do
    test "orders by line first" do
      assert Herb::Position[1, 99] < Herb::Position[2, 0]
    end

    test "orders by column within a line" do
      assert Herb::Position[1, 4] < Herb::Position[1, 9]
    end

    test "treats two positions on the same character as equal" do
      assert_equal Herb::Position[3, 2], Herb::Position[3, 2]
    end

    test "sorts a list the way it reads" do
      positions = [Herb::Position[2, 0], Herb::Position[1, 9], Herb::Position[1, 4]]

      assert_equal([[1, 4], [1, 9], [2, 0]], positions.sort.map { |position| [position.line, position.column] })
    end

    test "answers with nothing when compared with something else" do
      assert_nil Herb::Position[1, 0] <=> "1:0"
    end
  end
end
