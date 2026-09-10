# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class VisitorStackTest < Minitest::Spec
    class FirstVisitor < Herb::Visitor; end
    class SecondVisitor < Herb::Visitor; end
    class ThirdVisitor < Herb::Visitor; end

    class ReadingVisitor < Herb::Visitor
      def self.reads_erb_source? = true
    end

    class RewritingVisitor < Herb::Visitor
      def self.rewrites_erb_source? = true
    end

    class InliningVisitor < Herb::Visitor
      def self.inlines_renders? = true
    end

    class StyleRewritingVisitor < Herb::Visitor
      def self.rewrites_style_blocks? = true
    end

    class StyleReadingVisitor < Herb::Visitor
      def self.reads_style_blocks? = true
    end

    class ReadingAndRewritingVisitor < Herb::Visitor
      def self.reads_erb_source? = true
      def self.rewrites_erb_source? = true
    end

    def stack
      @stack ||= Herb::Visitor::Stack.build([FirstVisitor.new, SecondVisitor.new])
    end

    def classes(stack)
      stack.map(&:class)
    end

    test "is an Array, because callers already treat it as one" do
      assert_kind_of Array, stack
    end

    test "builds from a plain array" do
      assert_equal [FirstVisitor, SecondVisitor], classes(stack)
    end

    test "appends with use" do
      stack.use(ThirdVisitor.new)

      assert_equal [FirstVisitor, SecondVisitor, ThirdVisitor], classes(stack)
    end

    test "places one before an anchor" do
      stack.insert_before(SecondVisitor, ThirdVisitor.new)

      assert_equal [FirstVisitor, ThirdVisitor, SecondVisitor], classes(stack)
    end

    test "places one after an anchor" do
      stack.insert_after(FirstVisitor, ThirdVisitor.new)

      assert_equal [FirstVisitor, ThirdVisitor, SecondVisitor], classes(stack)
    end

    test "insert takes an anchor, the way the Rails middleware stack does" do
      stack.insert(SecondVisitor, ThirdVisitor.new)

      assert_equal [FirstVisitor, ThirdVisitor, SecondVisitor], classes(stack)
    end

    test "insert still takes an index, the way Array does" do
      stack.insert(0, ThirdVisitor.new)

      assert_equal [ThirdVisitor, FirstVisitor, SecondVisitor], classes(stack)
    end

    test "insert still takes several at once, the way Array does" do
      stack.insert(0, ThirdVisitor.new, ThirdVisitor.new)

      assert_equal [ThirdVisitor, ThirdVisitor, FirstVisitor, SecondVisitor], classes(stack)
    end

    test "insert_after takes an index too" do
      stack.insert_after(0, ThirdVisitor.new)

      assert_equal [FirstVisitor, ThirdVisitor, SecondVisitor], classes(stack)
    end

    test "anchors on the first match" do
      stack.use(FirstVisitor.new)
      stack.insert_after(FirstVisitor, ThirdVisitor.new)

      assert_equal [FirstVisitor, ThirdVisitor, SecondVisitor, FirstVisitor], classes(stack)
    end

    test "anchors on a superclass" do
      stack.insert_before(Herb::Visitor, ThirdVisitor.new)

      assert_equal [ThirdVisitor, FirstVisitor, SecondVisitor], classes(stack)
    end

    test "refuses to place against an anchor that is not there" do
      error = assert_raises(Herb::Visitor::Stack::UnknownVisitorError) do
        stack.insert_after(ThirdVisitor, FirstVisitor.new)
      end

      assert_includes error.message, "ThirdVisitor"
    end

    test "reports whether an anchor is present" do
      assert stack.include_visitor?(FirstVisitor)
      refute stack.include_visitor?(ThirdVisitor)
    end

    describe "how the engine composes it" do
      def compile(**)
        Herb::Engine.new("<div>Hello</div>", filename: "app/views/test.html.erb", **)
      end

      test "runs nothing unless the caller asks for something" do
        assert_empty compile.visitors
      end

      test "builds the validators in a settled order" do
        visitors = [
          Herb::Engine::Validators::SecurityValidator,
          Herb::Engine::Validators::NestingValidator,
          Herb::Engine::Validators::AccessibilityValidator
        ]

        assert_equal(visitors, classes(Herb::Engine::Validators.all))
      end

      test "hands the whole stack over when the caller names its own" do
        engine = compile(visitors: [ThirdVisitor.new])

        assert_equal [ThirdVisitor], classes(engine.visitors)
      end

      test "lets a caller build on the defaults rather than instead of them" do
        engine = compile(visitors: Herb::Engine::Validators.all.use(ThirdVisitor.new))

        assert_equal(3, engine.visitors.count { |visitor| visitor.is_a?(Herb::Engine::Validators::Base) })
        assert_equal ThirdVisitor, classes(engine.visitors).last
      end

      test "runs nothing when the caller asks for nothing" do
        assert_empty compile(visitors: []).visitors
      end

      test "makes its validators fatal by default" do
        assert(compile.visitors.all?(&:fatal?))
      end

      test "builds them non-fatal when asked" do
        refute(Herb::Engine::Validators.all(fatal: false).any?(&:fatal?))
      end

      test "honours a validator turned off in configuration" do
        engine = compile(visitors: Herb::Engine::Validators.all(security: false))

        refute engine.visitors.include_visitor?(Herb::Engine::Validators::SecurityValidator)
        assert engine.visitors.include_visitor?(Herb::Engine::Validators::NestingValidator)
      end

      test "runs the debug visitor last, so it annotates the finished tree" do
        engine = compile(visitors: [ThirdVisitor.new, Herb::Engine::DebugVisitor.new])

        assert_equal Herb::Engine::DebugVisitor, classes(engine.visitors).last
      end

      test "adds the debug visitor even when the caller passed its own" do
        engine = compile(visitors: [ThirdVisitor.new, Herb::Engine::DebugVisitor.new])

        assert engine.visitors.include_visitor?(Herb::Engine::DebugVisitor)
      end
    end

    describe "#arrange" do
      def arrange(*visitors)
        Herb::Visitor::Stack.arrange(visitors)
      end

      test "leaves a stack that already validates as it was" do
        visitors = [InliningVisitor.new, ReadingVisitor.new, FirstVisitor.new, RewritingVisitor.new]

        assert_equal classes(visitors), classes(arrange(*visitors))
      end

      test "keeps visitors that declare nothing in the order they were given" do
        assert_equal [FirstVisitor, SecondVisitor, ThirdVisitor], classes(arrange(FirstVisitor.new, SecondVisitor.new, ThirdVisitor.new))
      end

      test "moves a reader before the rewriter it was placed after" do
        assert_equal [ReadingVisitor, RewritingVisitor], classes(arrange(RewritingVisitor.new, ReadingVisitor.new))
      end

      test "moves a style reader after the style rewriter it was placed before" do
        assert_equal [StyleRewritingVisitor, StyleReadingVisitor], classes(arrange(StyleReadingVisitor.new, StyleRewritingVisitor.new))
      end

      test "moves an inlining visitor to the front" do
        assert_equal [InliningVisitor, FirstVisitor, SecondVisitor], classes(arrange(FirstVisitor.new, SecondVisitor.new, InliningVisitor.new))
      end

      test "holds a rewriter back until its reader has run and leaves the rest in place" do
        arranged = arrange(FirstVisitor.new, RewritingVisitor.new, SecondVisitor.new, ReadingVisitor.new, ThirdVisitor.new)

        assert_equal [FirstVisitor, SecondVisitor, ReadingVisitor, RewritingVisitor, ThirdVisitor], classes(arranged)
      end

      test "produces an order validate_order! accepts" do
        assert_nil arrange(StyleReadingVisitor.new, RewritingVisitor.new, FirstVisitor.new, ReadingVisitor.new, StyleRewritingVisitor.new, InliningVisitor.new).validate_order!
      end

      test "returns a stack, so placement keeps working on the result" do
        arranged = arrange(RewritingVisitor.new, ReadingVisitor.new).insert_after(ReadingVisitor, FirstVisitor.new)

        assert_equal [ReadingVisitor, FirstVisitor, RewritingVisitor], classes(arranged)
      end

      test "refuses two visitors that each have to run before the other" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          arrange(ReadingAndRewritingVisitor.new, ReadingAndRewritingVisitor.new)
        end

        assert_equal "Engine::VisitorStackTest::ReadingAndRewritingVisitor each have to run before the other, so no order of the stack satisfies what they declare. Drop one of them, or change what it declares.", error.message
      end

      test "refuses two inlining visitors, since only one can run first" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          arrange(FirstVisitor.new, InliningVisitor.new, InliningVisitor.new)
        end

        assert_equal "Engine::VisitorStackTest::InliningVisitor each have to run before the other, so no order of the stack satisfies what they declare. Drop one of them, or change what it declares.", error.message
      end

      test "names only the visitors in the knot, not the ones waiting behind it" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          arrange(RewritingVisitor.new, ReadingAndRewritingVisitor.new, ReadingAndRewritingVisitor.new)
        end

        assert_equal "Engine::VisitorStackTest::ReadingAndRewritingVisitor each have to run before the other, so no order of the stack satisfies what they declare. Drop one of them, or change what it declares.", error.message
      end
    end

    describe "#validate_order!" do
      def order(*visitors)
        Herb::Visitor::Stack.build(visitors)
      end

      test "refuses a reader that runs after a rewriter" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          order(RewritingVisitor.new, ReadingVisitor.new).validate_order!
        end

        assert_includes error.message, "ReadingVisitor"
        assert_includes error.message, "RewritingVisitor"
        assert_includes error.message, "has to run before"
      end

      test "accepts a reader that runs before a rewriter" do
        assert_nil order(ReadingVisitor.new, RewritingVisitor.new).validate_order!
      end

      test "accepts either one on its own" do
        assert_nil order(RewritingVisitor.new).validate_order!
        assert_nil order(ReadingVisitor.new).validate_order!
      end

      test "leaves a visitor that says nothing about source free to run anywhere" do
        assert_nil order(RewritingVisitor.new, FirstVisitor.new, SecondVisitor.new).validate_order!
      end

      test "looks past visitors in between" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          order(RewritingVisitor.new, FirstVisitor.new, ReadingVisitor.new).validate_order!
        end

        assert_includes error.message, "ReadingVisitor"
      end

      test "refuses an inlining visitor that runs after anything else" do
        error = assert_raises(Herb::Visitor::Stack::OrderError) do
          order(FirstVisitor.new, InliningVisitor.new).validate_order!
        end

        assert_includes error.message, "InliningVisitor"
        assert_includes error.message, "has to run first"
      end

      test "accepts an inlining visitor that runs first" do
        assert_nil order(InliningVisitor.new, FirstVisitor.new, ReadingVisitor.new).validate_order!
      end

      test "is what the engine checks before it compiles anything" do
        assert_raises(Herb::Visitor::Stack::OrderError) do
          Herb::Engine.new("<div>x</div>", visitors: [RewritingVisitor.new, ReadingVisitor.new])
        end
      end
    end
  end
end
