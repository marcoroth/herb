# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/slots/dynamics_compiler"

module Engine
  module Slots
    class StaticsTest < Minitest::Spec
      include SnapshotUtils

      def options
        { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client)], filename: "app/views/test.html.erb" }
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
        assert_evaluated_snapshot("<div><% if @a %>x<% end %></div>", { "@a" => true }, options)
      end

      test "parks nothing when a collection covered every branch between its items" do
        template = "<ul><% @items.each do |i| %><li><% if i.odd? %>odd<% else %>even<% end %></li><% end %></ul>"

        assert_evaluated_snapshot(template, { "@items" => [1, 2] }, options)
        assert_evaluated_snapshot(template, { "@items" => [1, 3] }, options)
      end

      test "parks a keyed collection's item template only when no row rendered" do
        template = %(<ul><% @items.each do |item| %><li id="<%= item %>"><%= item %></li><% end %></ul>)

        assert_evaluated_snapshot(template, { "@items" => ["a", "b"] }, options)
      end

      test "parks the item template, with its values blanked, when the collection rendered nothing" do
        assert_evaluated_snapshot(
          %(<ul><% @items.each do |item| %><li id="<%= item %>"><%= item %></li><% end %></ul>),
          { "@items" => [] },
          options
        )
      end

      test "parks no item template for an unkeyed collection, which has no addressable items" do
        assert_evaluated_snapshot("<ul><% @items.each do |item| %><li><%= item %></li><% end %></ul>", { "@items" => ["a", "b"] }, options)
      end

      test "parks the branches of one conditional and not of another" do
        markup = parked("<% if @a %>a<% end %><% if @b %>b<% end %>", { "@a" => true, "@b" => false })

        assert_equal ["1:0"], markup.scan(/herb-branch:(\d+:\d+)/).flatten
      end

      test "keeps what it counts to itself" do
        assert_compiled_snapshot("<div><% if @a %>x<% end %></div>", options)
      end

      test "parks a branch once for a partial rendered many times in one response" do
        source = Herb::Engine.new("<div><% if @a %>x<% else %>y<% end %></div>", **options).src
        view = Object.new
        view.instance_variable_set(:@_herb_covered, {})
        view.define_singleton_method(:render) do |a|
          @a = a
          instance_eval(source, __FILE__, __LINE__)
        end

        rendered = Array.new(3) { view.render(true) }.join

        assert_equal 1, rendered.scan("<template").size
      end

      test "parks nothing at all in server mode, and counts nothing either" do
        compiled = Herb::Engine.new(
          "<div><% if @a %>x<% else %>y<% end %></div>",
          visitors: [Herb::Engine::Slots::Visitor.new(mode: :server)],
          filename: "app/views/test.html.erb"
        ).src

        assert_snapshot_matches(compiled, "compiled in server mode")
        assert_snapshot_matches(evaluate_herb_source(compiled, { "@a" => false }), "rendered in server mode")
      end

      test "parks nothing for an interpolated attribute, whose stretches the manifest carries" do
        assert_evaluated_snapshot(
          %(<div id="message_<%= @id %>" class="row-<%= @kind %>-of-<%= @size %>">x</div>),
          { "@id" => 7, "@kind" => "a", "@size" => "b" },
          options
        )
      end

      test "carries an interpolated attribute's static segments in the manifest" do
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client)

        Herb::Engine.new(%(<div id="message_<%= @id %>" class="row-<%= @kind %>-of-<%= @size %>">x</div>), visitors: [visitor], filename: "app/views/test.html.erb")

        assert_equal({ "0" => ["message_", ""], "1" => ["row-", "-of-", ""] }, visitor.manifest["parts"])
      end

      test "the values payload carries an interpolated attribute as its dynamic parts" do
        template = %(<div class="row-<%= @kind %>-of-<%= @size %>">x</div>)
        source = Herb::Engine::Slots::DynamicsCompiler.new(template, filename: "app/views/test.html.erb").src
        payload = evaluate_herb_source(source, { "@kind" => "a", "@size" => "b" })

        assert_equal ["a", "b"], payload[:slots][0]
      end

      test "parks no segments for an attribute holding more than outputs" do
        assert_evaluated_snapshot(%(<div class="x<% if @a %>y<% end %>z">c</div>), { "@a" => true }, options)
      end

      test "parks nothing at all unless the mode asks for it" do
        source = Herb::Engine.new(
          "<div><% if @a %>x<% end %></div>",
          visitors: [Herb::Engine::Slots::Visitor.new],
          filename: "app/views/test.html.erb"
        ).src

        assert_snapshot_matches(evaluate_herb_source(source, { "@a" => false }), "rendered with no delivery asked for")
      end
    end
  end
end
