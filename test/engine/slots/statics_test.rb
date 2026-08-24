# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slot_visitor"
require_relative "../../../lib/herb/engine/dynamics_compiler"

module Engine
  module Slots
    class StaticsTest < Minitest::Spec
      include SnapshotUtils

      def options
        { visitors: [Herb::Engine::SlotVisitor.new(mode: :client)], filename: "app/views/test.html.erb" }
      end

      def render(template, locals = {})
        evaluate_herb_source(Herb::Engine.new(template, **options).src, locals)
      end

      def parked(template, locals = {})
        render(template, locals)[%r{<template data-herb-region="[^"]+">(.*)</template>}m, 1]
      end

      test "parks the branch that did not render" do
        assert_evaluated_snapshot(
          "<div><% if @admin %><b>Hi <%= @name %></b><% else %><i>guest</i><% end %></div>",
          { "@admin" => false, "@name" => "Marco" },
          options
        )
      end

      test "parks the arms of a case that did not run" do
        assert_evaluated_snapshot(
          "<div><% case @s %><% when 1 %>one<% when 2 %>two<% else %>other<% end %></div>",
          { "@s" => 3 },
          options
        )
      end

      test "parks the other branch when the first one ran" do
        assert_evaluated_snapshot(
          "<div><% if @admin %><b>Hi <%= @name %></b><% else %><i>guest</i><% end %></div>",
          { "@admin" => true, "@name" => "Marco" },
          options
        )
      end

      test "parks a conditional nested in a branch on its own rather than inside its parent" do
        assert_evaluated_snapshot(
          "<p><% if @a %><% if @b %>deep<% end %>outer<% end %></p>",
          { "@a" => false, "@b" => false },
          options
        )
      end

      test "keeps the markers of the slots inside a branch, so the client can fill them" do
        assert_evaluated_snapshot(
          %(<div><% if @a %><span class="<%= @c %>"><%= @name %></span><% end %></div>),
          { "@a" => false, "@c" => "item", "@name" => "Marco" },
          options
        )
      end

      test "parks nothing for a template that has no conditionals" do
        assert_evaluated_snapshot("<p>Hi <%= @name %></p>", { "@name" => "Marco" }, options)
      end

      test "names the template it belongs to, so it does not depend on where it sits" do
        output = render("<div><% if @a %>x<% end %></div>", { "@a" => false })

        assert_match(%r{<template data-herb-region="app/views/test\.html\.erb:[0-9a-f]{8}">}, output)
      end

      test "names the version the region marker names" do
        output = render("<div><% if @a %>x<% end %></div>", { "@a" => false })
        version = output[/<!--herb-region:[^:]+:([0-9a-f]+):\d+-->/, 1]

        assert_includes output, %(<template data-herb-region="app/views/test.html.erb:#{version}">)
      end

      test "sits outside the region it belongs to" do
        output = render("<div><% if @a %>x<% end %></div>", { "@a" => false })

        assert_operator output.index("<!--/herb-region:"), :<, output.index("<template")
      end

      test "carries the branch marker, which is what says which parked branch is which" do
        assert_equal "<!--herb-branch:0:0-->x", parked("<div><% if @a %>x<% end %></div>", { "@a" => false })
      end

      test "orders branches by the slot they belong to" do
        markup = parked("<% if @a %>a<% if @b %>b<% end %><% end %><% if @c %>c<% end %>", { "@a" => false, "@b" => false, "@c" => false })

        assert_equal ["0:0", "1:0", "2:0"], markup.scan(/herb-branch:(\d+:\d+)/).flatten
      end

      test "parks nothing when a conditional has no branch left to send" do
        output = render("<div><% if @a %>x<% end %></div>", { "@a" => true })

        assert_snapshot_matches(output, "statics parks nothing when no branch is left")
      end

      test "parks nothing when a collection covered every branch between its items" do
        template = "<ul><% @items.each do |i| %><li><% if i.odd? %>odd<% else %>even<% end %></li><% end %></ul>"

        assert_snapshot_matches(render(template, { "@items" => [1, 2] }), "statics collection covers every branch")
        assert_equal "<!--herb-branch:1:1-->even", parked(template, { "@items" => [1, 3] })
      end

      test "parks a keyed collection's item template even when the collection rendered rows" do
        template = %(<ul><% @items.each do |item| %><li id="<%= item %>"><%= item %></li><% end %></ul>)

        assert_snapshot_matches(parked(template, { "@items" => ["a", "b"] }), "statics keyed collection parks item template with rows")
        assert_snapshot_matches(parked(template, { "@items" => [] }), "statics keyed collection parks item template when empty")
      end

      test "parks the item template with its values blanked" do
        template = %(<ul><% @items.each do |item| %><li id="<%= item %>"><%= item %></li><% end %></ul>)
        markup = parked(template, { "@items" => ["a", "b"] })

        assert_snapshot_matches(markup, "statics parks item template blanked")
      end

      test "parks no item template for an unkeyed collection, which has no addressable items" do
        template = "<ul><% @items.each do |item| %><li><%= item %></li><% end %></ul>"

        assert_snapshot_matches(render(template, { "@items" => ["a", "b"] }), "statics unkeyed collection parks no item template")
      end

      test "parks the branches of one conditional and not of another" do
        markup = parked("<% if @a %>a<% end %><% if @b %>b<% end %>", { "@a" => true, "@b" => false })

        assert_equal ["1:0"], markup.scan(/herb-branch:(\d+:\d+)/).flatten
      end

      test "keeps what it counts to itself" do
        output = render("<div><% if @a %>x<% end %></div>", { "@a" => true })

        assert_snapshot_matches(output, "statics keeps the branch counter to itself")
      end

      test "parks nothing at all in server mode, and counts nothing either" do
        compiled = Herb::Engine.new(
          "<div><% if @a %>x<% else %>y<% end %></div>",
          visitors: [Herb::Engine::SlotVisitor.new(mode: :server)],
          filename: "app/views/test.html.erb"
        ).src

        assert_snapshot_matches(compiled, "statics server mode compiles no parking")
        assert_snapshot_matches(evaluate_herb_source(compiled, { "@a" => false }), "statics server mode renders slot markers")
      end

      test "parks an interpolated attribute's static segments" do
        template = %(<div id="message_<%= @id %>" class="row-<%= @kind %>-of-<%= @size %>">x</div>)
        markup = parked(template, { "@id" => 7, "@kind" => "a", "@size" => "b" })

        assert_snapshot_matches(markup, "statics parks interpolated attribute segments")
      end

      test "the values payload carries an interpolated attribute as its dynamic parts" do
        template = %(<div class="row-<%= @kind %>-of-<%= @size %>">x</div>)
        source = Herb::Engine::DynamicsCompiler.new(template, filename: "app/views/test.html.erb").src
        payload = evaluate_herb_source(source, { "@kind" => "a", "@size" => "b" })

        assert_equal ["a", "b"], payload[:slots][0]
      end

      test "parks no segments for an attribute holding more than outputs" do
        rendered = render(%(<div class="x<% if @a %>y<% end %>z">c</div>), { "@a" => true })

        assert_snapshot_matches(rendered, "statics parks no segments for a mixed attribute")
      end

      test "parks nothing at all unless the mode asks for it" do
        source = Herb::Engine.new(
          "<div><% if @a %>x<% end %></div>",
          visitors: [Herb::Engine::SlotVisitor.new],
          filename: "app/views/test.html.erb"
        ).src

        assert_snapshot_matches(evaluate_herb_source(source, { "@a" => false }), "statics parks nothing unless the mode asks")
      end
    end
  end
end
