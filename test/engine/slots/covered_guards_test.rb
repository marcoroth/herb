# frozen_string_literal: true

require "prism"

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    # The parked statics are appended after the template body and guarded by
    # `@_herb_covered`. Apps measuring branch coverage of templates need every
    # generated branch to be reachable and to sit on a line of the source file.
    class CoveredGuardsTest < Minitest::Spec
      include SnapshotUtils

      class GuardCollector < Prism::Visitor
        Guard = Struct.new(:predicate, :start_line, :end_line, :enclosing, keyword_init: true)

        attr_reader :guards

        def initialize
          super
          @guards = []
          @stack = []
        end

        def visit_unless_node(node)
          predicate = node.predicate.slice.strip

          @guards << Guard.new(
            predicate: predicate,
            start_line: node.location.start_line,
            end_line: node.location.end_line,
            enclosing: @stack.dup
          )

          @stack.push(predicate)
          super
          @stack.pop
        end
      end

      def options
        { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client)], filename: "app/views/test.html.erb" }
      end

      def compile(template)
        Herb::Engine.new(template, **options).src
      end

      def covered_guards(template)
        collector = GuardCollector.new
        Prism.parse(compile(template)).value.accept(collector)

        collector.guards.select { |guard| guard.predicate.include?("@_herb_covered") }
      end

      def assert_no_redundant_guard(template)
        guards = covered_guards(template)

        refute_empty guards, "expected the template to park statics behind @_herb_covered guards"

        redundant = guards.select { |guard| guard.enclosing.include?(guard.predicate) }

        assert_empty redundant, <<~MESSAGE
          An `unless` repeats the predicate of an `unless` it is nested in, so its skip branch can never run:
          #{redundant.map { |guard| "  line #{guard.start_line}: unless #{guard.predicate}" }.join("\n")}

          #{compile(template)}
        MESSAGE
      end

      def assert_guards_within_source(template)
        guards = covered_guards(template)
        last_line = template.lines.count

        refute_empty guards, "expected the template to park statics behind @_herb_covered guards"

        outside = guards.select { |guard| guard.end_line > last_line }

        assert_empty outside, <<~MESSAGE
          The template has #{last_line} lines, but these guards reach past it, where no simplecov:disable comment can exclude them:
          #{outside.map { |guard| "  lines #{guard.start_line}-#{guard.end_line}: unless #{guard.predicate}" }.join("\n")}

          #{compile(template)}
        MESSAGE
      end

      collection = <<~ERB
        <ul>
          <% %i[a b].each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      ERB

      conditional = <<~ERB
        <div>
          <% if @admin %>
            <b>Admin</b>
          <% end %>
        </div>
      ERB

      two_conditionals = <<~ERB
        <div>
          <% if @a %>
            <b>a</b>
          <% end %>
          <% if @b %>
            <i>b</i>
          <% end %>
        </div>
      ERB

      test "does not nest a guard for a collection's only parked entry inside a guard on the same key" do
        assert_no_redundant_guard(collection)
      end

      test "does not nest a guard for a conditional's only parked entry inside a guard on the same key" do
        assert_no_redundant_guard(conditional)
      end

      test "keeps a guard per entry when several entries are parked, since each can be covered on its own" do
        guards = covered_guards(two_conditionals)
        outer = guards.find { |guard| guard.predicate.include?("&&") }

        assert outer, "expected an outer guard covering every entry"

        inner = guards.select { |guard| guard.enclosing.include?(outer.predicate) }

        assert_equal 2, inner.size
        assert_no_redundant_guard(two_conditionals)
      end

      test "keeps the guards of a parked collection row on the source's lines" do
        assert_guards_within_source(collection)
      end

      test "keeps the guards of a parked conditional branch on the source's lines" do
        assert_guards_within_source(conditional)
      end

      test "keeps the guards of several parked entries on the source's lines" do
        assert_guards_within_source(two_conditionals)
      end

      test "parks a row template whose markup keeps the source's newlines, whatever line its code sits on" do
        template = <<~ERB
          <ul>
            <% @items.each do |item| %>
              <li><%= item %></li>
            <% end %>
          </ul>
        ERB

        output = evaluate_herb_source(compile(template), { "@items" => [] })
        parked = output[%r{<template data-herb-region="[^"]+">(.*)</template>}m, 1]

        assert parked, "expected an empty collection to park its row template"
        assert_includes parked, "\n    <li data-herb-slot=\"1:child\"></li>\n  "
      end
    end
  end
end
