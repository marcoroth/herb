# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine/instrumentation"
require_relative "../../lib/herb/engine/instrumentation/query_collector"
require_relative "../../lib/herb/engine/instrumentation_visitor"

require "active_support"
require "json"

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

    test "a tag keeps its value when it is the last expression of a block" do
      assert_equal "1", evaluate("<% data = wrap do %><% {n: 1} %><% end %><%= data[:n] %>", wrap: ->(&block) { block.call })
    end

    test "a local assigned in an output tag stays visible to later tags" do
      assert_equal "5|5", evaluate("<%= total = 5 %>|<%= total %>")
    end

    test "a local assigned in a statement tag stays visible to later tags" do
      assert_equal "5", evaluate("<% total = 5 %><%= total %>")
    end

    test "a frame is left even when a tag raises" do
      engine = Herb::Engine.new("<%= boom %>", instrumentation_options)

      Herb::Engine::Instrumentation.track do
        context = Object.new
        context.define_singleton_method(:boom) { raise "boom" }

        assert_raises(RuntimeError) { context.instance_eval(engine.src) }
      end

      assert_empty Herb::Engine::Instrumentation.stack
    end

    test "an assignment in an output tag is framed rather than wrapped" do
      assert_compiled_snapshot("<%= total = items.sum %>", instrumentation_options)
    end

    test "a registered collector is used without naming it per scope" do
      collector = Herb::Engine::Instrumentation::QueryCollector.new

      Herb::Engine::Instrumentation.register(collector)

      begin
        engine = Herb::Engine.new("<%= lookup %>", instrumentation_options)

        Herb::Engine::Instrumentation.start

        test_case = self
        context = Object.new
        context.define_singleton_method(:lookup) { test_case.send(:query, "SELECT 1") }
        context.instance_eval(engine.src)

        report = Herb::Engine::Instrumentation.finish

        assert_equal ["SELECT 1"], report.first[:queries]
      ensure
        Herb::Engine::Instrumentation.unregister_all
      end
    end

    test "finish returns the report and closes the scope" do
      Herb::Engine::Instrumentation.start
      Herb::Engine::Instrumentation.at("index.html.erb", 1, 0) { nil }

      assert_predicate Herb::Engine::Instrumentation, :tracking?

      Herb::Engine::Instrumentation.finish

      refute_predicate Herb::Engine::Instrumentation, :tracking?
      assert_empty Herb::Engine::Instrumentation.report
    end

    test "a scope that was never finished is discarded by the next one" do
      Herb::Engine::Instrumentation.start
      Herb::Engine::Instrumentation.enter("index.html.erb", 1, 0)

      Herb::Engine::Instrumentation.start

      assert_empty Herb::Engine::Instrumentation.stack
      assert_empty Herb::Engine::Instrumentation.finish
    end

    test "a tag that ran one query is reported as information" do
      diagnostic = diagnose("<%= lookup %>", lookup: -> { query("SELECT 1") }).first

      assert_equal :info, diagnostic.severity
      assert_equal "query-in-template", diagnostic.code
      assert_equal "This tag ran 1 query", diagnostic.message
      assert_nil diagnostic.suggestion
    end

    test "a tag that ran more than one query is reported as a warning" do
      diagnostic = diagnose("<% [1, 2, 3].each do |i| %><%= lookup %><% end %>", lookup: -> { query("SELECT 1") }).first

      assert_equal :warning, diagnostic.severity
      assert_equal "n-plus-one", diagnostic.code
      assert_equal "This tag ran 3 queries", diagnostic.message
      assert_includes diagnostic.suggestion, "controller"
    end

    test "a diagnostic carries the position and the queries behind it" do
      diagnostic = diagnose("<%= lookup %>", lookup: -> { query("SELECT 1") }).first

      assert_equal ["index.html.erb", 1, 0], [diagnostic.filename, diagnostic.line, diagnostic.column]
      assert_equal ["SELECT 1"], diagnostic.data[:queries]
      assert_equal :runtime, diagnostic.phase
      assert_equal "QueryCollector", diagnostic.source
    end

    test "a diagnostic serializes for the wire" do
      diagnostic = diagnose("<%= lookup %>", lookup: -> { query("SELECT 1") }).first
      parsed = JSON.parse(diagnostic.to_json)

      assert_equal "info", parsed["severity"]
      assert_equal "index.html.erb", parsed["filename"]
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

    def evaluate(source, **locals)
      engine = Herb::Engine.new(source, instrumentation_options)

      context = Object.new

      locals.each do |name, value|
        context.define_singleton_method(name) { |&block| block ? value.call(&block) : value.call }
      end

      Herb::Engine::Instrumentation.track { context.instance_eval(engine.src) }

      context.instance_eval(engine.src)
    end

    def diagnose(source, **locals)
      collector = Herb::Engine::Instrumentation::QueryCollector.new
      engine = Herb::Engine.new(source, instrumentation_options)

      Herb::Engine::Instrumentation.start(collectors: [collector])

      begin
        context = Object.new

        locals.each do |name, value|
          context.define_singleton_method(name) { |&block| block ? value.call(&block) : value.call }
        end

        collector.attach { context.instance_eval(engine.src) }

        Herb::Engine::Instrumentation.diagnostics
      ensure
        Herb::Engine::Instrumentation.finish
      end
    end

    def query(sql, cached: false, name: nil)
      ActiveSupport::Notifications.instrument("sql.active_record", sql: sql, cached: cached, name: name) { nil }
    end
  end
end
