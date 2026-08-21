# frozen_string_literal: true

require_relative "test_helper"

class InternedTokenValueTest < Minitest::Spec
  test "token values up to 16 bytes are shared and frozen" do
    values = tag_name_values("abcdefghijklmnop")

    assert_equal 2, values.length
    assert_same values.first, values.last
    assert_predicate values.first, :frozen?
  end

  test "token values over 16 bytes remain independent and mutable" do
    values = tag_name_values("abcdefghijklmnopq")

    assert_equal 2, values.length
    refute_same values.first, values.last
    refute_predicate values.first, :frozen?

    values.first.replace("changed")

    assert_equal "changed", values.first
    assert_equal "abcdefghijklmnopq", values.last
  end

  test "short token values can be replaced through the writer" do
    token = Herb.lex("<div>").value.find { |candidate| candidate.value == "div" }

    assert_raises(FrozenError) { token.value.replace("main") }

    replacement = +"main"
    token.value = replacement

    assert_equal "main", token.value
    assert_same replacement, token.value
    refute_predicate token.value, :frozen?
  end

  test "tree inspection does not change the token value encoding" do
    token = Herb::Token.from(:identifier, "div".b)

    token.tree_inspect

    assert_equal Encoding::ASCII_8BIT, token.value.encoding
  end

  private

  def tag_name_values(name)
    Herb.lex("<#{name}></#{name}>").value.filter_map do |token|
      token.value if token.value == name
    end
  end
end
