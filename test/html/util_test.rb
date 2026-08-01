# frozen_string_literal: true

require_relative "../test_helper"

module HTML
  class UtilTest < Minitest::Spec
    test "void_element? returns true for void elements" do
      ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].each do |tag|
        assert Herb::HTML::Util.void_element?(tag), "Expected '#{tag}' to be a void element"
      end
    end

    test "void_element? is case insensitive" do
      assert Herb::HTML::Util.void_element?("BR")
      assert Herb::HTML::Util.void_element?("Img")
      assert Herb::HTML::Util.void_element?("INPUT")
    end

    test "void_element? returns false for non-void elements" do
      ["div", "span", "p", "a", "h1", "section", "nav", "script", "style", "form", "button", "textarea", "select"].each do |tag|
        refute Herb::HTML::Util.void_element?(tag), "Expected '#{tag}' to not be a void element"
      end
    end
  end
end
