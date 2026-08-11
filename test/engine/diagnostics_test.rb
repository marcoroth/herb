# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class DiagnosticsTest < Minitest::Spec
    class RewritingReporter < Herb::Visitor
      include Herb::Engine::ContextAware
      include Herb::Engine::Diagnostics

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

    def compile(source, **)
      Herb::Engine.new(source, filename: "app/views/test.html.erb", **)
    end

    test "a visitor that rewrites the tree can also report" do
      visitor = RewritingReporter.new

      compile("<marquee>Hello</marquee>", visitors: [visitor], validation_mode: :none)

      assert_equal 1, visitor.diagnostics.length

      diagnostic = visitor.diagnostics.first

      assert_equal "obsolete-element", diagnostic.code
      assert_equal :warning, diagnostic.severity
      assert_equal "app/views/test.html.erb", diagnostic.template
      assert_equal "Use CSS animations instead.", diagnostic.suggestion
    end

    test "the rewrite still reaches the compiled output" do
      engine = compile("<marquee>Hello</marquee>", visitors: [RewritingReporter.new], validation_mode: :none)

      assert_includes engine.src, "<div>"
      refute_includes engine.src, "<marquee>"
    end

    test "the engine surfaces what a visitor reported in overlay mode" do
      engine = compile("<marquee>Hello</marquee>", visitors: [RewritingReporter.new], validation_mode: :overlay)

      assert_includes engine.validation_error_template, "data-herb-validation-error"
      assert_includes engine.validation_error_template, 'data-code="obsolete-element"'
      assert_includes engine.validation_error_template, 'data-severity="warning"'
    end

    test "a reporting visitor and a validator both reach the overlay" do
      engine = compile("<p><div><marquee>x</marquee></div></p>", visitors: [RewritingReporter.new], validation_mode: :overlay)

      assert_includes engine.validation_error_template, 'data-code="invalid-nesting"'
      assert_includes engine.validation_error_template, 'data-code="obsolete-element"'
    end

    test "a visitor reporting an error raises in raise mode" do
      visitor = RewritingReporter.new

      def visitor.visit_html_element_node(node)
        error("Not allowed.", node.location, code: "NotAllowed") if node.open_tag&.tag_name&.value == "marquee"

        Herb::Visitor.instance_method(:visit_html_element_node).bind_call(self, node)
      end

      assert_raises(Herb::Engine::CompilationError) do
        compile("<marquee>Hello</marquee>", visitors: [visitor], validation_mode: :raise)
      end
    end

    test "a visitor that reports nothing changes nothing" do
      engine = compile("<div>Hello</div>", visitors: [RewritingReporter.new], validation_mode: :overlay)

      assert_nil engine.validation_error_template
    end

    test "a visitor without the mixin is left alone" do
      plain = Class.new(Herb::Visitor).new

      engine = compile("<div>Hello</div>", visitors: [plain], validation_mode: :overlay)

      assert_nil engine.validation_error_template
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
  end
end
