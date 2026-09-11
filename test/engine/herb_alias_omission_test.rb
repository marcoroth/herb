# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class HerbAliasOmissionTest < Minitest::Spec
    include SnapshotUtils

    def compile(source, **)
      Herb::Engine.new(source, escape: true, **).src
    end

    test "the alias is omitted when the compiled template never calls it" do
      compiled = compile("<h1><% if a %><div>x</div><% end %></h1>")

      refute_includes compiled, "__herb"

      assert_snapshot_matches(compiled, "herb_alias_omission_test-0")
    end

    test "the alias is kept when an escaped expression calls it" do
      compiled = compile("<div><%= value %></div>")

      assert_includes compiled, "__herb = ::Herb::Engine;"
      assert_includes compiled, "__herb.h((value))"

      assert_snapshot_matches(compiled, "herb_alias_omission_test-1")
    end

    test "the alias is kept for an escaped attribute value" do
      compiled = compile('<div class="<%= value %>">x</div>')

      assert_includes compiled, "__herb = ::Herb::Engine;"
      assert_includes compiled, "__herb.attr((value))"

      assert_snapshot_matches(compiled, "herb_alias_omission_test-2")
    end

    test "a custom escape function drops the alias it no longer needs" do
      compiled = compile('<div class="<%= value %>">x</div>', attrfunc: "CustomEscape.attribute")

      refute_includes compiled, "__herb"
      assert_includes compiled, "CustomEscape.attribute((value))"

      assert_snapshot_matches(compiled, "herb_alias_omission_test-3")
    end

    test "the kept alias evaluates" do
      compiled = compile("<div><%= value %></div>")
      render = eval("->(value) { #{compiled} }", binding, __FILE__, __LINE__)

      assert_equal "<div>&lt;b&gt;</div>", render.call("<b>")
    end

    test "escape false never emits the alias" do
      refute_includes Herb::Engine.new("<div><%= value %></div>").src, "__herb"

      assert_snapshot_matches(Herb::Engine.new("<div><%= value %></div>").src, "herb_alias_omission_test-4")
    end
  end
end
