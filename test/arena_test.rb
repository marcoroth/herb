# frozen_string_literal: true

require_relative "test_helper"

class ArenaTest < Minitest::Spec
  test "Arena class exists" do
    assert defined?(Herb::Arena)
  end

  test "creating an arena with default size" do
    arena = Herb::Arena.new
    assert_instance_of Herb::Arena, arena
    assert arena.capacity > 0
  end

  test "creating an arena with custom size" do
    arena = Herb::Arena.new(size: 1024 * 1024)
    assert_instance_of Herb::Arena, arena
    assert arena.capacity >= 1024 * 1024
  end

  test "arena position starts at zero" do
    arena = Herb::Arena.new
    assert_equal 0, arena.position
  end

  test "arena position increases after parsing" do
    arena = Herb::Arena.new
    initial_position = arena.position

    Herb.parse("<div>hello</div>", arena: arena)

    assert arena.position > initial_position
  end

  test "arena can be reused for multiple parse calls" do
    arena = Herb::Arena.new

    result1 = Herb.parse("<div>first</div>", arena: arena)
    position_after_first = arena.position

    result2 = Herb.parse("<span>second</span>", arena: arena)
    position_after_second = arena.position

    assert result1
    assert result2
    assert position_after_second > position_after_first
  end

  test "arena reset returns position to zero" do
    arena = Herb::Arena.new

    Herb.parse("<div>hello</div>", arena: arena)
    assert arena.position > 0

    arena.reset
    assert_equal 0, arena.position
  end

  test "arena can be reused after reset" do
    arena = Herb::Arena.new

    result1 = Herb.parse("<div>first</div>", arena: arena)
    arena.reset

    result2 = Herb.parse("<span>second</span>", arena: arena)

    assert result1
    assert result2
  end

  test "arena stats prints stats and returns nil" do
    arena = Herb::Arena.new
    result = arena.stats
    assert_nil result
  end

  test "multiple arenas can be used independently" do
    arena1 = Herb::Arena.new
    arena2 = Herb::Arena.new

    Herb.parse("<div>first</div>", arena: arena1)
    position1 = arena1.position

    Herb.parse("<span>second</span>", arena: arena2)
    position2 = arena2.position

    assert position1 > 0
    assert position2 > 0
    assert_equal position1, arena1.position
  end

  test "parsing without arena still works" do
    result = Herb.parse("<div>hello</div>")
    assert result
    assert result.value
  end

  test "parsing many templates with shared arena" do
    arena = Herb::Arena.new

    100.times do |i|
      result = Herb.parse("<div>template #{i}</div>", arena: arena)
      assert result
      assert result.value
    end

    assert arena.position > 0
  end

  test "arena reset allows reuse for batch processing" do
    arena = Herb::Arena.new

    3.times do |batch|
      10.times do |i|
        result = Herb.parse("<div>batch #{batch} item #{i}</div>", arena: arena)
        assert result
      end
      arena.reset
      assert_equal 0, arena.position
    end
  end
end
