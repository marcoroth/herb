# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class DiagnosticsTest < Minitest::Spec
    include SnapshotUtils

    class RewritingReporter < Herb::Visitor
      include Herb::Visitor::ContextAware
      include Herb::Visitor::Diagnostics

      def inspect
        "#<#{self.class.name}>"
      end

      def visit_html_element_node(node)
        if node.open_tag&.tag_name&.value == "marquee"
          warning("The `<marquee>` element is obsolete.", node.location, code: "ObsoleteElement", suggestion: "Use CSS animations instead.")

          node.open_tag.tag_name.value.replace("div")

          close_tag_name = node.close_tag&.tag_name&.value
          close_tag_name&.replace("div")
        end

        super
      end
    end

    FILENAME = "app/views/test.html.erb"

    def compile(source, **)
      Herb::Engine.new(source, filename: FILENAME, **)
    end

    def reporting_stack(visitor)
      Herb::Engine::Validators.all(fatal: false).use(visitor)
    end

    def compile_snapshot(source, **)
      assert_compiled_snapshot(source, filename: FILENAME, **)
    end

    def render_into_session(engine)
      Herb::Engine::Runtime::Session.capture { eval(engine.src) }
    end

    test "a visitor that rewrites the tree can also report" do
      visitor = RewritingReporter.new

      compile("<marquee>Hello</marquee>", visitors: [visitor])

      assert_equal 1, visitor.diagnostics.length

      diagnostic = visitor.diagnostics.first

      assert_equal "ObsoleteElement", diagnostic.code
      assert_equal :warning, diagnostic.severity
      assert_equal FILENAME, diagnostic.template
      assert_equal "Use CSS animations instead.", diagnostic.suggestion
    end

    test "the rewrite reaches the compiled output" do
      engine = compile_snapshot("<marquee>Hello</marquee>", visitors: [RewritingReporter.new])

      assert_includes engine.src, "'<div>Hello</div>'"
    end

    test "the engine hands what a visitor reported to whatever session renders it" do
      engine = compile_snapshot("<marquee>Hello</marquee>", visitors: reporting_stack(RewritingReporter.new))

      diagnostic = render_into_session(engine).diagnostics.first

      assert_equal "ObsoleteElement", diagnostic.code
      assert_equal :warning, diagnostic.severity
      assert_equal FILENAME, diagnostic.template
      assert_equal "Use CSS animations instead.", diagnostic.suggestion
      assert_equal :compile, diagnostic.phase
    end

    test "keeps the position it was found at, still counting columns from zero" do
      engine = compile_snapshot("<p><div>x</div></p>", visitors: Herb::Engine::Validators.all(fatal: false))

      location = render_into_session(engine).diagnostics.first.location

      assert_equal 1, location.start.line
      assert_equal 3, location.start.column
    end

    test "a reporting visitor and a validator both reach the session" do
      engine = compile_snapshot("<p><div><marquee>x</marquee></div></p>", visitors: reporting_stack(RewritingReporter.new))

      codes = render_into_session(engine).diagnostics.map(&:code)

      assert_includes codes, "InvalidNestingError"
      assert_includes codes, "ObsoleteElement"
    end

    test "carries a message intact whatever it contains" do
      visitor = AwkwardReporter.new
      engine = compile_snapshot("<div>x</div>", visitors: reporting_stack(visitor))

      assert_equal AwkwardReporter::MESSAGE, render_into_session(engine).diagnostics.first.message
    end

    test "emits nothing for a template with nothing to say" do
      engine = compile_snapshot("<div>Hello</div>", visitors: reporting_stack(RewritingReporter.new))

      refute_includes engine.src, "record_compile_diagnostics"
    end

    test "a visitor without the mixin is left alone" do
      engine = compile_snapshot("<div>Hello</div>", visitors: Herb::Engine::Validators.all(fatal: false))

      refute_includes engine.src, "record_compile_diagnostics"
    end

    test "a fatal visitor raises the exception it named" do
      assert_raises(NotAllowedError) do
        compile("<marquee>Hello</marquee>", visitors: [NamedErrorReporter.new])
      end
    end

    test "a visitor that calls itself fatal aborts compilation" do
      assert_raises(Herb::Engine::CompilationError) do
        compile("<marquee>Hello</marquee>", visitors: [FailingReporter.new])
      end
    end

    test "a visitor that reports an error without being fatal still compiles" do
      reporter = RewritingReporter.new

      reporter.define_singleton_method(:visit_html_element_node) do |node|
        error("Not allowed.", node.location, code: "NotAllowed")

        Herb::Visitor.instance_method(:visit_html_element_node).bind_call(self, node)
      end

      engine = compile("<marquee>Hello</marquee>", visitors: [reporter])

      assert_includes engine.src, "record_compile_diagnostics"
    end

    describe "the mixin on its own" do
      test "collects by severity" do
        reporter = RewritingReporter.new
        location = Herb::Location.from(1, 0, 1, 4)

        reporter.error("e", location)
        reporter.warning("w", location)
        reporter.info("i", location)
        reporter.hint("h", location)

        assert_equal 4, reporter.diagnostic_count
        assert_equal 1, reporter.diagnostic_count(:hint)
        assert_equal ["e"], reporter.errors.map(&:message)
        assert_equal ["w"], reporter.warnings.map(&:message)
        assert_predicate reporter, :errors?
        assert_predicate reporter, :warnings?
      end

      test "reports against an unknown template when it has no context" do
        reporter = RewritingReporter.new
        reporter.warning("w", nil)

        assert_equal Herb::Visitor::Context::UNKNOWN_FILE_PATH, reporter.diagnostics.first.template
      end

      test "marks what it finds as found at compile time" do
        reporter = RewritingReporter.new
        reporter.warning("w", nil)

        assert_equal :compile, reporter.diagnostics.first.phase
      end
    end

    class AwkwardReporter < RewritingReporter
      MESSAGE = "A \"quoted\" and a\nnewline and \#{interpolation}"

      def visit_html_element_node(node)
        warning(MESSAGE, node.location, code: "AwkwardMessage")

        Herb::Visitor.instance_method(:visit_html_element_node).bind_call(self, node)
      end
    end

    class NotAllowedError < Herb::Engine::CompilationError
      def initialize(message, line: nil, column: nil, filename: nil, suggestion: nil)
        super([filename, line, column, message, suggestion].compact.join(":"))
      end
    end

    # Any visitor can name the exception its findings raise; the engine never has to know which.
    class NamedErrorReporter < RewritingReporter
      def fatal?
        true
      end

      def visit_html_element_node(node)
        if node.open_tag&.tag_name&.value == "marquee"
          error("Not allowed.", node.location, code: "NotAllowed", error_class: NotAllowedError)
        end

        Herb::Visitor.instance_method(:visit_html_element_node).bind_call(self, node)
      end
    end

    class FailingReporter < RewritingReporter
      def fatal?
        true
      end

      def visit_html_element_node(node)
        error("Not allowed.", node.location, code: "NotAllowed") if node.open_tag&.tag_name&.value == "marquee"

        Herb::Visitor.instance_method(:visit_html_element_node).bind_call(self, node)
      end
    end
  end
end
