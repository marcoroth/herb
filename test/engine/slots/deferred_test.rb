# frozen_string_literal: true

require "json"

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/slots/dynamics_compiler"

module Engine
  module Slots
    class DeferredTest < Minitest::Spec
      include SnapshotUtils

      ASYNC = <<~ERB
        <%# herb:slots client %>
        <Async>
          <p id="stats"><%= @stats %></p>
          <Fallback><p class="pulse">crunching <%= @hint %></p></Fallback>
        </Async>
      ERB

      class OverridableView
        def initialize(overrides)
          @overrides = overrides
        end

        def __herb_state_overrides
          @overrides
        end
      end

      def page_options
        { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)], filename: "app/views/test.html.erb" }
      end

      def compile(source, mode: :client)
        visitor = Herb::Engine::Slots::Visitor.new(mode: mode, fatal: false)
        engine = Herb::Engine.new(source, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor, engine]
      end

      test "an async block compiles to a steered conditional on an internal state" do
        visitor, = compile(ASYNC)

        assert_equal [:conditional, :child, :child], visitor.slots.map(&:type)
        assert_equal({ 0 => { mode: "async", state: "_herb_block_0", timing: {} } }, visitor.deferred_entries)
        assert_empty visitor.diagnostics
      end

      test "the first render carries the fallback and withholds the primary" do
        assert_evaluated_snapshot(ASYNC, { "__herb_state_overrides" => nil, "@stats" => "42 things", "@hint" => "soon" }, page_options)
      end

      test "the fallback's ERB evaluates on every render" do
        _, engine = compile(ASYNC)

        first = OverridableView.new(nil)
        first.instance_variable_set(:@hint, "later")

        second = OverridableView.new(nil)
        second.instance_variable_set(:@hint, "sooner")

        assert_equal first.instance_eval(engine.src).sub("later", "sooner"), second.instance_eval(engine.src)
      end

      test "the manifest declares the internal state and maps the block" do
        visitor, = compile(ASYNC)
        states = visitor.manifest["states"]

        assert_equal({ "0" => { "mode" => "async", "state" => "_herb_block_0", "fallback" => 1, "reads" => [] } }, states["fragments"])

        declaration = states["declarations"].fetch(0)

        assert_equal "_herb_block_0", declaration["name"]
        assert declaration["internal"]
        assert_equal({ "arms" => [{ "branch" => 0, "condition" => ["_herb_block_0", nil] }], "else" => 1 }, states["conditionals"]["0"])
      end

      test "a lazy block records its own mode" do
        visitor, = compile(ASYNC.gsub("Async", "Lazy"))

        assert_equal "lazy", visitor.deferred_entries.fetch(0)[:mode]
        assert_equal "lazy", visitor.manifest["states"]["fragments"]["0"]["mode"]
      end

      test "two deferred blocks number their states in document order" do
        source = ASYNC + ASYNC.gsub("Async", "Lazy").gsub("stats", "extra")

        visitor, = compile(source)
        names = visitor.deferred_entries.values.map { |info| info[:state] }

        assert_equal ["_herb_block_0", "_herb_block_1"], names
      end

      test "the values program answers the fallback branch until steered" do
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(ASYNC, filename: "app/views/test.html.erb")

        view = OverridableView.new(nil)
        view.instance_variable_set(:@hint, "soon")
        values = view.instance_eval(compiler.src)

        assert_equal({ "branch" => 1, "slots" => { "2" => "soon" } }, JSON.parse(JSON.generate(values))["slots"]["0"])
      end

      test "steering the internal state answers the primary with its statics" do
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(ASYNC, filename: "app/views/test.html.erb")

        view = OverridableView.new({ "app/views/test.html.erb" => { "_herb_block_0" => true } })
        view.instance_variable_set(:@stats, "42 things")
        values = JSON.parse(JSON.generate(view.instance_eval(compiler.src)))

        assert_snapshot_matches(JSON.pretty_generate(values), ASYNC, { probe: "steered values" })
      end

      test "a deferred block without a fallback renders nothing initially" do
        source = <<~ERB
          <%# herb:slots client %>
          <Async>
            <p id="stats"><%= @stats %></p>
          </Async>
        ERB

        visitor, = compile(source)

        assert_empty visitor.diagnostics
        assert_evaluated_snapshot(source, { "__herb_state_overrides" => nil, "@stats" => "42 things" }, page_options)
      end

      test "two fallbacks in a deferred block error" do
        source = <<~ERB
          <%# herb:slots client %>
          <Lazy>
            <p><%= @a %></p>
            <Fallback><p>one</p></Fallback>
            <Fallback><p>two</p></Fallback>
          </Lazy>
        ERB

        visitor, = compile(source)

        assert_equal ["A `<Lazy>` holds 2 `<Fallback>` elements, and it can only stand one in."], visitor.diagnostics.map(&:message)
      end

      test "an unknown attribute on a deferred block errors" do
        visitor, = compile(%(<%# herb:slots client %>\n<Async id="x"><p><%= @a %></p></Async>))

        assert_equal ["`<Async>` only takes `delay` and `hold` and `on`."], visitor.diagnostics.map(&:message)
      end

      test "timing attributes and state reads flow into a deferred entry" do
        source = <<~ERB
          <%# herb:slots client %>
          <%# herb:state (peek: "") %>
          <input value="<%= peek %>">
          <Lazy delay="0" hold="500">
            <p><%= Geo.locate(peek) %></p>
            <Fallback><p class="pulse">wait</p></Fallback>
          </Lazy>
        ERB

        visitor, = compile(source)
        entry = visitor.manifest["states"]["fragments"].fetch("1")

        assert_equal "lazy", entry["mode"]
        assert_equal 0, entry["delay"]
        assert_equal 500, entry["hold"]
        assert_equal [2], entry["reads"]
        assert_empty visitor.diagnostics
      end

      test "a deferred block inside a collection errors" do
        source = <<~ERB
          <%# herb:slots client %>
          <ul>
            <% @tiles.each do |tile| %>
              <li>
                <Async>
                  <p><%= Metrics.load(tile) %></p>
                  <Fallback><p class="pulse">tile loading</p></Fallback>
                </Async>
              </li>
            <% end %>
          </ul>
        ERB

        visitor, = compile(source)

        assert_equal ["A `<Async>` sits inside a collection, and a deferred block cannot stand per item yet."], visitor.diagnostics.map(&:message)
      end

      test "a deferred block wrapping a collection passes" do
        source = <<~ERB
          <%# herb:slots client %>
          <Lazy>
            <ul>
              <% @tiles.each do |tile| %>
                <li><%= tile %></li>
              <% end %>
            </ul>
            <Fallback><p class="pulse">tiles loading</p></Fallback>
          </Lazy>
        ERB

        visitor, = compile(source)

        assert_empty visitor.diagnostics
      end

      test "the page and values compiles agree on indexes and state names" do
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(ASYNC, filename: "app/views/test.html.erb")
        page_visitor, = compile(ASYNC)

        assert_equal page_visitor.deferred_entries, compiler.slot_visitor.deferred_entries
      end
    end
  end
end
