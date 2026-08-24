# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class HerbAliasOmissionTest < Minitest::Spec
    include SnapshotUtils

    def compile(source, **)
      Herb::Engine.new(source, escape: true, **).src
    end

    test "the alias is omitted when the compiled template never calls it" do
      assert_snapshot_matches(compile("<h1><% if a %><div>x</div><% end %></h1>"), "alias omitted when unused")
    end

    test "the alias is kept when an escaped expression calls it" do
      assert_snapshot_matches(compile("<div><%= value %></div>"), "alias kept for escaped expression")
    end

    test "the alias is kept for an escaped attribute value" do
      assert_snapshot_matches(compile(%(<div class="<%= value %>">x</div>)), "alias kept for escaped attribute")
    end

    test "a custom escape function drops the alias it no longer needs" do
      assert_snapshot_matches(compile(%(<div class="<%= value %>">x</div>), attrfunc: "CustomEscape.attribute"), "custom escape drops alias")
    end

    test "the kept alias evaluates" do
      compiled = compile("<div><%= value %></div>")
      render = eval("->(value) { #{compiled} }", binding, __FILE__, __LINE__)

      assert_equal "<div>&lt;b&gt;</div>", render.call("<b>")
    end

    test "escape false never emits the alias" do
      assert_snapshot_matches(Herb::Engine.new("<div><%= value %></div>").src, "escape false never emits alias")
    end
  end
end
