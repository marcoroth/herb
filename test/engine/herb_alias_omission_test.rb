# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class HerbAliasOmissionTest < Minitest::Spec
    def compile(source, **)
      Herb::Engine.new(source, escape: true, **).src
    end

    test "the alias is omitted when the compiled template never calls it" do
      compiled = compile("<h1><% if a %><div>x</div><% end %></h1>")

      refute_includes compiled, "__herb"
    end

    test "the alias is kept when an escaped expression calls it" do
      compiled = compile("<div><%= value %></div>")

      assert_includes compiled, "__herb = ::Herb::Engine;"
      assert_includes compiled, "__herb.h((value))"
    end

    test "the alias is kept for an escaped attribute value" do
      compiled = compile('<div class="<%= value %>">x</div>')

      assert_includes compiled, "__herb = ::Herb::Engine;"
      assert_includes compiled, "__herb.attr((value))"
    end

    test "a custom escape function drops the alias it no longer needs" do
      compiled = compile('<div class="<%= value %>">x</div>', attrfunc: "CustomEscape.attribute")

      refute_includes compiled, "__herb"
      assert_includes compiled, "CustomEscape.attribute((value))"
    end

    test "the kept alias evaluates" do
      compiled = compile("<div><%= value %></div>")
      render = eval("->(value) { #{compiled} }", binding, __FILE__, __LINE__)

      assert_equal "<div>&lt;b&gt;</div>", render.call("<b>")
    end

    test "escape false never emits the alias" do
      refute_includes Herb::Engine.new("<div><%= value %></div>").src, "__herb"
    end
  end
end
