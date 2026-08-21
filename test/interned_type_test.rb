# frozen_string_literal: true

require_relative "test_helper"

class InternedTypeTest < Minitest::Spec
  test "token type strings are frozen and shared" do
    first = Herb.lex("<").value.first
    second = Herb.lex("<").value.first

    assert_predicate first.type, :frozen?
    assert_same first.type, second.type
  end

  test "AST node type strings are frozen and shared" do
    first = Herb.parse("<div></div>").value
    second = Herb.parse("<span></span>").value

    assert_predicate first.type, :frozen?
    assert_same first.type, second.type
  end

  test "long token values remain mutable and independently allocated" do
    long = "abcdefghijklmnopq"
    first = Herb.lex("<#{long}>").value.find { |token| token.value == long }
    second = Herb.lex("<#{long}>").value.find { |token| token.value == long }

    refute_predicate first.value, :frozen?
    refute_same first.value, second.value

    first.value.replace("changed")

    assert_equal "changed", first.value
    assert_equal long, second.value
  end
end
