# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require "action_view"
require "herb/engine/optimize_visitor"

module Engine
  class OptimizedHelpersTest < Minitest::Spec
    include SnapshotUtils

    FILENAME = "app/views/posts/index.html.erb"
    TAG_OWNER = "ActionView::Helpers::TagHelper"

    module OverriddenTag
      def tag(*) = "whatever this application wanted instead"
    end

    def stock_context
      Class.new { include ::ActionView::Helpers::TagHelper }.new
    end

    def overriding_context
      Class.new do
        include ::ActionView::Helpers::TagHelper
        include OverriddenTag
      end.new
    end

    DEFAULT_SOURCE = "<%= tag.div do %>Content<% end %>"

    def compile(source = DEFAULT_SOURCE, verify: true)
      Herb::Engine.new(source, filename: FILENAME, visitors: [Herb::Engine::OptimizeVisitor.new(verify: verify)]).src
    end

    def assert_optimized_snapshot(source = DEFAULT_SOURCE, verify: true)
      assert_compiled_snapshot(source, filename: FILENAME, visitors: [Herb::Engine::OptimizeVisitor.new(verify: verify)])
    end

    def diagnostics_from(context, compiled = compile)
      Herb::Engine::Report::Session.capture { context.instance_eval(compiled) }.diagnostics
    end

    describe "what it compiles in" do
      test "guards the diagnostic with the comparison that decides it" do
        assert_optimized_snapshot
      end

      test "compiles nothing in unless asked" do
        assert_optimized_snapshot(verify: false)
      end

      test "compiles nothing in when the template optimized no helpers" do
        assert_optimized_snapshot("<div>Written as HTML</div>")
      end

      test "guards each distinct helper once" do
        assert_optimized_snapshot(%(<%= tag.div %><%= tag.span %><%= link_to "a", "/b" %>))
      end

      test "guards a helper from every module it optimized against" do
        assert_optimized_snapshot(%(<%= image_tag "a.png" %><%= javascript_tag "x()" %>))
      end

      test "carries the position of the element the helper produced" do
        assert_optimized_snapshot("<div>\n  <%= tag.span %>\n</div>")
      end
    end

    describe "what it reports" do
      test "reports a helper the application has overwritten" do
        diagnostic = diagnostics_from(overriding_context).first

        assert_equal "overwritten-helper", diagnostic.code
        assert_equal :warning, diagnostic.severity
        assert_equal FILENAME, diagnostic.template
        assert_equal 1, diagnostic.location.start.line
        assert_includes diagnostic.message, "`tag` was compiled away as #{TAG_OWNER}"
      end

      test "names the module that took the helper over" do
        diagnostic = diagnostics_from(overriding_context).first

        assert_match(/defined by \S*OverriddenTag\z/, diagnostic.message)
      end

      test "still names an override that has no name of its own" do
        anonymous = Module.new { def tag(*) = "anonymous" }
        context = Class.new { include ::ActionView::Helpers::TagHelper }.tap { |k| k.include(anonymous) }.new

        assert_match(/defined by #<Module:0x[0-9a-f]+>\z/, diagnostics_from(context).first.message)
      end

      test "stays quiet when the helper is still Action View's" do
        assert_empty diagnostics_from(stock_context)
      end

      test "stays quiet when the view has no such helper at all" do
        assert_empty diagnostics_from(Object.new)
      end

      test "builds nothing at all while the helper is intact" do
        compiled = compile
        context = stock_context

        context.instance_eval(compiled)

        before = GC.stat(:total_allocated_objects)
        context.instance_eval(compiled)

        assert_operator GC.stat(:total_allocated_objects) - before, :<, 20
      end

      test "reports once however many times the template renders" do
        compiled = compile
        context = overriding_context

        session = Herb::Engine::Report::Session.capture do
          5.times { context.instance_eval(compiled) }
        end

        assert_equal 1, session.diagnostics.length
      end

      test "reports again for the next page rather than once per process" do
        compiled = compile
        context = overriding_context

        counts = 3.times.map do
          Herb::Engine::Report::Session.capture { context.instance_eval(compiled) }.diagnostics.length
        end

        assert_equal [1, 1, 1], counts
      end
    end
  end
end
