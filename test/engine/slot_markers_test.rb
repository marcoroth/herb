# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class SlotMarkersTest < Minitest::Spec
    include SnapshotUtils

    OPTIONS = { slots: true, filename: "app/views/test.html.erb", validation_mode: :none }.freeze

    test "delimits a child slot with paired comments" do
      assert_evaluated_snapshot("<p><%= @name %></p>", { "@name" => "Marco" }, OPTIONS)
    end

    test "gives sibling interpolations independent slots" do
      assert_evaluated_snapshot(
        "<p>Hi <%= @name %>, you have <%= @count %></p>",
        { "@name" => "Marco", "@count" => 3 },
        OPTIONS
      )
    end

    test "leaves an empty addressable position when a conditional is false" do
      assert_evaluated_snapshot(
        "<div><% if @admin %><b>secret</b><% end %></div>",
        { "@admin" => false },
        OPTIONS
      )
    end

    test "delimits slots nested inside another slot" do
      assert_evaluated_snapshot(
        "<div><% if @admin %><b><%= @secret %></b><% end %></div>",
        { "@admin" => true, "@secret" => "s" },
        OPTIONS
      )
    end

    test "a nested slot only exists once its parent branch renders" do
      assert_evaluated_snapshot(
        "<div><% if @admin %><b><%= @secret %></b><% end %></div>",
        { "@admin" => false, "@secret" => "s" },
        OPTIONS
      )
    end

    test "anchors attribute slots on the element instead of inside the tag" do
      assert_evaluated_snapshot(%(<div class="<%= @klass %>"></div>), { "@klass" => "card" }, OPTIONS)
    end

    test "does not inject markers into raw text elements" do
      assert_evaluated_snapshot(%(<script>var a = "<%= @a %>";</script>), { "@a" => "1" }, OPTIONS)
    end

    test "wraps the document in a region marker carrying file and version" do
      assert_evaluated_snapshot("<p><%= @name %></p>", { "@name" => "x" }, OPTIONS)
    end

    test "compiles slot markers into the generated source" do
      assert_compiled_snapshot("<p><%= @name %></p>", OPTIONS)
    end

    test "keeps head content free of injected elements" do
      assert_evaluated_snapshot(
        %(<head><meta name="a" content="b"><title><%= @t %></title></head>),
        { "@t" => "T" },
        OPTIONS
      )
    end

    test "keeps SVG subtrees free of injected elements" do
      assert_evaluated_snapshot(
        %(<svg viewBox="0 0 1 1"><circle r="<%= @r %>"></circle></svg>),
        { "@r" => "4" },
        OPTIONS
      )
    end

    test "keeps adjacent siblings adjacent for CSS combinators" do
      assert_evaluated_snapshot(
        %(<div><input class="peer"><%= @x %><p class="peer-checked:block">y</p></div>),
        { "@x" => "" },
        OPTIONS
      )
    end

    test "never emits a wrapper element" do
      [
        ["<p><%= @x %></p>", { "@x" => "a" }],
        ["<div><% if @x %><b>y</b><% end %></div>", { "@x" => true }],
        ["<ul><% @x.each do |i| %><li>i</li><% end %></ul>", { "@x" => ["a"] }]
      ].each do |template, locals|
        engine = Herb::Engine.new(template, **OPTIONS)
        output = evaluate_herb_source(engine.src, locals)

        refute_includes output, "<span", "expected no wrapper element for: #{template}"
        refute_includes output, "display: contents"
      end
    end

    test "renders the same content as an unslotted template" do
      template = %(<div class="a"><h1><%= @title %></h1><% if @admin %><b>x</b><% end %></div>)
      locals = { "@title" => "T", "@admin" => true }

      slotted = evaluate_herb_source(Herb::Engine.new(template, **OPTIONS).src, locals)
      plain = evaluate_herb_source(Herb::Engine.new(template, validation_mode: :none).src, locals)

      assert_equal plain, slotted.gsub(%r{<!--/?herb-(slot|region)[^>]*-->}, "")
    end
  end
end
