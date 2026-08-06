# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine/query_tracker"
require_relative "../../lib/herb/engine/query_tracker_visitor"

require "active_support"

module Engine
  class QueryTrackerTest < Minitest::Spec
    include SnapshotUtils

    def tracker_options
      {
        escape: false,
        parser_options: { iteration_nodes: true },
        visitors: [Herb::Engine::QueryTrackerVisitor.new(filename: "index.html.erb")],
      }
    end

    test "an output tag is wrapped so its value survives" do
      assert_compiled_snapshot("<%= user.name %>", tracker_options)
    end

    test "a statement tag is inlined so assignments stay visible" do
      assert_compiled_snapshot("<% total = items.sum %>", tracker_options)
    end

    test "a comment tag is left alone" do
      assert_compiled_snapshot("<%# nothing to see %>", tracker_options)
    end

    test "an iteration block is surrounded by its own frame" do
      assert_compiled_snapshot("<% items.each do |item| %><%= item %><% end %>", tracker_options)
    end

    test "a conditional is surrounded by its own frame" do
      assert_compiled_snapshot("<% if admin? %><%= secret %><% end %>", tracker_options)
    end

    test "a nested tag gets its own position" do
      assert_compiled_snapshot("<% users.each do |user| %>\n  <%= user.name %>\n<% end %>", tracker_options)
    end

    test "html around the tags is untouched" do
      assert_compiled_snapshot("<div><%= title %></div>", tracker_options)
    end

    test "a template without a filename still records positions" do
      assert_compiled_snapshot("<%= title %>", {
        escape: false,
        visitors: [Herb::Engine::QueryTrackerVisitor.new],
      })
    end

    test "attributes a query to the tag that ran it" do
      report = render("<%= lookup %>", lookup: -> { query("SELECT 1") })

      assert_equal 1, report.size
      assert_equal ["index.html.erb", 1, 0], [report.first.filename, report.first.line, report.first.column]
      assert_equal ["SELECT 1"], report.first.queries
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

      assert_equal ["SELECT 3"], report.first.queries
    end

    test "does not attribute a query that runs outside of a tag" do
      report = Herb::Engine::QueryTracker.track { query("SELECT 1") }

      assert_empty report
    end

    test "leaves the stack empty after tracking" do
      Herb::Engine::QueryTracker.track { Herb::Engine::QueryTracker.at("index.html.erb", 1, 0) { nil } }

      assert_empty Herb::Engine::QueryTracker.stack
    end

    private

    def render(source, **locals)
      engine = Herb::Engine.new(source, tracker_options)

      Herb::Engine::QueryTracker.track do
        context = Object.new

        locals.each { |name, value| context.define_singleton_method(name) { |&block| block ? value.call(&block) : value.call } }

        context.instance_eval(engine.src)
      end
    end

    def query(sql, cached: false, name: nil)
      ActiveSupport::Notifications.instrument("sql.active_record", sql: sql, cached: cached, name: name) { nil }
    end
  end
end
