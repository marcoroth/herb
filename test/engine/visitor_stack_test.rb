# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class VisitorStackTest < Minitest::Spec
    class FirstVisitor < Herb::Visitor; end
    class SecondVisitor < Herb::Visitor; end
    class ThirdVisitor < Herb::Visitor; end

    def stack
      @stack ||= Herb::Engine::VisitorStack.build([FirstVisitor.new, SecondVisitor.new])
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
      error = assert_raises(Herb::Engine::VisitorStack::UnknownVisitorError) do
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

      test "runs the validators first" do
        visitors = [
          Herb::Engine::Validators::SecurityValidator,
          Herb::Engine::Validators::NestingValidator,
          Herb::Engine::Validators::AccessibilityValidator
        ]

        assert_equal(visitors, classes(compile.visitors))
      end

      test "keeps the validators when the caller passes its own visitors" do
        engine = compile(visitors: [ThirdVisitor.new])

        assert_equal(3, engine.visitors.count { |visitor| visitor.is_a?(Herb::Engine::Validator) })
        assert_equal ThirdVisitor, classes(engine.visitors).last
      end

      test "drops the validators when there is nothing to report to" do
        assert_empty compile(validation_mode: :none).visitors
      end

      test "honours a validator turned off in configuration" do
        engine = compile(validators: { security: false })

        refute engine.visitors.include_visitor?(Herb::Engine::Validators::SecurityValidator)
        assert engine.visitors.include_visitor?(Herb::Engine::Validators::NestingValidator)
      end

      test "runs the debug visitor last, so it annotates the finished tree" do
        engine = compile(visitors: [ThirdVisitor.new], debug: true)

        assert_equal Herb::Engine::DebugVisitor, classes(engine.visitors).last
      end

      test "adds the debug visitor even when the caller passed its own" do
        engine = compile(visitors: [ThirdVisitor.new], debug: true)

        assert engine.visitors.include_visitor?(Herb::Engine::DebugVisitor)
      end
    end
  end
end
