# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class DiagnosticsTest < Minitest::Spec
    include SnapshotUtils

    class RewritingReporter < Herb::Visitor
      include Herb::Engine::ContextAware
      include Herb::Engine::Diagnostics

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

    def compile_snapshot(source, **)
      assert_compiled_snapshot(source, filename: FILENAME, **)
    end

    def render_into_session(engine)
      Herb::Engine::Report::Session.capture { eval(engine.src) }
    end

    test "a visitor that rewrites the tree can also report" do
      visitor = RewritingReporter.new

      compile("<marquee>Hello</marquee>", visitors: [visitor], validation_mode: :none)

      assert_equal 1, visitor.diagnostics.length

      diagnostic = visitor.diagnostics.first

      assert_equal "obsolete-element", diagnostic.code
      assert_equal :warning, diagnostic.severity
      assert_equal FILENAME, diagnostic.template
      assert_equal "Use CSS animations instead.", diagnostic.suggestion
    end

    test "the rewrite reaches the compiled output" do
      engine = compile_snapshot("<marquee>Hello</marquee>", visitors: [RewritingReporter.new], validation_mode: :none)

      refute_includes engine.src, "marquee"
    end

    test "the engine hands what a visitor reported to whatever session renders it" do
      engine = compile_snapshot("<marquee>Hello</marquee>", visitors: [RewritingReporter.new], validation_mode: :overlay)

      diagnostic = render_into_session(engine).diagnostics.first

      assert_equal "obsolete-element", diagnostic.code
      assert_equal :warning, diagnostic.severity
      assert_equal FILENAME, diagnostic.template
      assert_equal "Use CSS animations instead.", diagnostic.suggestion
      assert_equal :compile, diagnostic.phase
    end

    test "keeps the position it was found at, still counting columns from zero" do
      engine = compile_snapshot("<p><div>x</div></p>", validation_mode: :overlay)

      location = render_into_session(engine).diagnostics.first.location

      assert_equal 1, location.start.line
      assert_equal 3, location.start.column
    end

    test "a reporting visitor and a validator both reach the session" do
      engine = compile_snapshot("<p><div><marquee>x</marquee></div></p>", visitors: [RewritingReporter.new], validation_mode: :overlay)

      codes = render_into_session(engine).diagnostics.map(&:code)

      assert_includes codes, "invalid-nesting"
      assert_includes codes, "obsolete-element"
    end

    test "carries a message intact whatever it contains" do
      visitor = AwkwardReporter.new
      engine = compile_snapshot("<div>x</div>", visitors: [visitor], validation_mode: :overlay)

      assert_equal AwkwardReporter::MESSAGE, render_into_session(engine).diagnostics.first.message
    end

    test "emits nothing for a template with nothing to say" do
      engine = compile_snapshot("<div>Hello</div>", visitors: [RewritingReporter.new], validation_mode: :overlay)

      refute_includes engine.src, "record_compile_diagnostics"
      assert_nil engine.validation_error_template
    end

    test "a visitor without the mixin is left alone" do
      engine = compile_snapshot("<div>Hello</div>", validation_mode: :overlay)

      refute_includes engine.src, "record_compile_diagnostics"
    end

    test "a visitor reporting an error raises in raise mode" do
      assert_raises(Herb::Engine::CompilationError) do
        compile("<marquee>Hello</marquee>", visitors: [FailingReporter.new], validation_mode: :raise)
      end
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

        assert_equal Herb::Engine::VisitorContext::UNKNOWN_FILE_PATH, reporter.diagnostics.first.template
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

    class FailingReporter < RewritingReporter
      def visit_html_element_node(node)
        error("Not allowed.", node.location, code: "NotAllowed") if node.open_tag&.tag_name&.value == "marquee"

        Herb::Visitor.instance_method(:visit_html_element_node).bind_call(self, node)
      end
    end
  end
end
