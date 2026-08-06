# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine/instrumentation"
require_relative "../../lib/herb/engine/instrumentation/query_collector"
require_relative "../../lib/herb/engine/instrumentation_visitor"

require "active_support"

module Engine
  class InstrumentationTest < Minitest::Spec
    include SnapshotUtils

    def instrumentation_options
      {
        escape: false,
        filename: "index.html.erb",
        parser_options: { iteration_nodes: true },
        visitors: [Herb::Engine::InstrumentationVisitor.new],
      }
    end

    test "the template announces itself" do
      assert_compiled_snapshot("<div>static</div>", instrumentation_options)
    end

    test "an output tag is wrapped so its value survives" do
      assert_compiled_snapshot("<%= user.name %>", instrumentation_options)
    end

    test "a statement tag is inlined so assignments stay visible" do
      assert_compiled_snapshot("<% total = items.sum %>", instrumentation_options)
    end

    test "a comment tag is left alone" do
      assert_compiled_snapshot("<%# nothing to see %>", instrumentation_options)
    end

    test "an iteration block is surrounded by its own frame" do
      assert_compiled_snapshot("<% items.each do |item| %><%= item %><% end %>", instrumentation_options)
    end

    test "a conditional is surrounded by its own frame" do
      assert_compiled_snapshot("<% if admin? %><%= secret %><% end %>", instrumentation_options)
    end

    test "a nested tag gets its own position" do
      assert_compiled_snapshot("<% users.each do |user| %>\n  <%= user.name %>\n<% end %>", instrumentation_options)
    end

    test "a template without a filename still records positions" do
      assert_compiled_snapshot("<%= title %>", {
        escape: false,
        visitors: [Herb::Engine::InstrumentationVisitor.new],
      })
    end

    test "attributes a query to the tag that ran it" do
      report = render("<%= lookup %>", lookup: -> { query("SELECT 1") })

      assert_equal 1, report.size
      assert_equal ["index.html.erb", 1, 0], [report.first.filename, report.first.line, report.first.column]
      assert_equal ["SELECT 1"], report.first[:queries]
    end

    test "attributes a query to the innermost tag" do
      report = render("<% wrap do %><%= lookup %><% end %>", wrap: ->(&block) { block.call }, lookup: -> { query("SELECT 1") })

      assert_equal 1, report.size
      assert_equal 13, report.first.column
    end

    test "counts a query once per iteration of the tag that ran it" do
      report = render("<% [1, 2, 3].each do |i| %><%= lookup %><% end %>", lookup: -> { query("SELECT 1") })

      assert_equal 1, report.size
      assert_equal 3, report.first.count
    end

    test "ignores cached queries and schema statements" do
      report = render("<%= lookup %>", lookup: lambda {
        query("SELECT 1", cached: true)
        query("SELECT 2", name: "SCHEMA")
        query("SELECT 3")
      })

      assert_equal ["SELECT 3"], report.first[:queries]
    end

    test "does not attribute a query that runs outside of a tag" do
      report = track { query("SELECT 1") }

      assert_empty report
    end

    test "collects nothing without a collector" do
      report = Herb::Engine::Instrumentation.track do
        Herb::Engine::Instrumentation.at("index.html.erb", 1, 0) { query("SELECT 1") }
      end

      assert_empty report
    end

    test "tells a collector which template is rendering" do
      collector = Class.new do
        attr_reader :identifiers

        def initialize
          @identifiers = []
        end

        def attach(&block)
          block.call
        end

        def rendering(identifier)
          @identifiers << identifier
        end
      end.new

      engine = Herb::Engine.new("<%= title %>", instrumentation_options)

      Herb::Engine::Instrumentation.track(collectors: [collector]) do
        context = Object.new
        context.define_singleton_method(:title) { "hello" }
        context.instance_eval(engine.src)
      end

      assert_equal ["index.html.erb"], collector.identifiers
    end

    test "leaves the stack empty after tracking" do
      track { Herb::Engine::Instrumentation.at("index.html.erb", 1, 0) { nil } }

      assert_empty Herb::Engine::Instrumentation.stack
    end

    private

    def track(&)
      Herb::Engine::Instrumentation.track(collectors: [Herb::Engine::Instrumentation::QueryCollector.new], &)
    end

    def render(source, **locals)
      engine = Herb::Engine.new(source, instrumentation_options)

      track do
        context = Object.new

        locals.each do |name, value|
          context.define_singleton_method(name) { |&block| block ? value.call(&block) : value.call }
        end

        context.instance_eval(engine.src)
      end
    end

    def query(sql, cached: false, name: nil)
      ActiveSupport::Notifications.instrument("sql.active_record", sql: sql, cached: cached, name: name) { nil }
    end
  end
end
