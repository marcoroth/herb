# frozen_string_literal: true

require "stringio"

require_relative "../test_helper"
require_relative "../../lib/herb/visitor/experimental"
require_relative "../../lib/herb/engine/component/visitor"
require_relative "../../lib/herb/engine/visitors/instrumentation_visitor"
require_relative "../../lib/herb/engine/visitors/optimize_visitor"
require_relative "../../lib/herb/engine/scoped_style/visitor"
require_relative "../../lib/herb/engine/slots/visitor"

module Engine
  class ExperimentalTest < Minitest::Spec
    ANNOUNCED = [
      Herb::Engine::Component::Visitor,
      Herb::Engine::InstrumentationVisitor,
      Herb::Engine::OptimizeVisitor,
      Herb::Engine::ScopedStyle::Visitor,
      Herb::Engine::Slots::Visitor
    ].freeze

    def announcing(notice = "Nothing here is settled yet.")
      Class.new do
        extend Herb::Visitor::Experimental

        experimental notice
      end
    end

    def said(&)
      captured = StringIO.new
      original = $stderr
      $stderr = captured

      yield

      captured.string.lines.grep(/\[Herb\]/).map(&:strip)
    ensure
      $stderr = original
    end

    test "says a notice the first time one is built" do
      assert_equal(["[Herb] Nothing here is settled yet."], said { announcing.new })
    end

    test "says it once however many are built after that" do
      klass = announcing

      assert_equal(["[Herb] Nothing here is settled yet."], said { 5.times { klass.new } })
    end

    test "says nothing for a class that never declared one" do
      klass = Class.new { extend Herb::Visitor::Experimental }

      assert_empty(said { klass.new })
    end

    test "keeps one class's notice out of another's" do
      first = announcing("The first is experimental.")
      second = announcing("The second is experimental.")

      assert_equal(["[Herb] The second is experimental."], said { second.new })
      assert_equal(["[Herb] The first is experimental."], said { first.new })
    end

    test "hands the arguments a class was built with straight through" do
      klass = Class.new do
        extend Herb::Visitor::Experimental

        experimental "Built anyway."

        attr_reader :taken

        def initialize(*positional, **keyword, &block)
          @taken = [positional, keyword, block&.call]
        end
      end

      built = said { @built = klass.new(1, 2, three: 3) { :block } }

      assert_equal ["[Herb] Built anyway."], built
      assert_equal [[1, 2], { three: 3 }, :block], @built.taken
    end

    test "every experimental visitor says so through the same mechanism" do
      assert_equal(ANNOUNCED, ANNOUNCED.select { |klass| klass.singleton_class.include?(Herb::Visitor::Experimental) })
    end
  end
end
