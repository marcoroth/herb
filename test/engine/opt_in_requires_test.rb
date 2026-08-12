# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class OptInRequiresTest < Minitest::Spec
    OPT_IN = {
      "Herb::Engine::Validators" => "herb/engine/validators",
      "Herb::Engine::DebugVisitor" => "herb/engine/debug_visitor",
      "Herb::Engine::OptimizeVisitor" => "herb/engine/optimize_visitor",
      "Herb::Engine::SlotVisitor" => "herb/engine/slot_visitor",
      "Herb::Engine::Report::Middleware" => "herb/engine/report/middleware",
    }.freeze

    def in_fresh_process(script)
      lib = File.expand_path("../../lib", __dir__)

      IO.popen([RbConfig.ruby, "-I#{lib}", "-e", script], err: [:child, :out], &:read).strip
    end

    OPT_IN.each do |constant, path|
      test "#{constant} is not loaded by requiring herb alone" do
        output = in_fresh_process(<<~RUBY)
          require "herb"
          print defined?(#{constant}) ? "loaded" : "absent"
        RUBY

        assert_equal "absent", output
      end

      test "#{constant} is available after requiring #{path}" do
        output = in_fresh_process(<<~RUBY)
          require "herb"
          require "#{path}"
          print defined?(#{constant}) ? "loaded" : "absent"
        RUBY

        assert_equal "loaded", output
      end
    end

    test "compiling still works with nothing but herb required" do
      output = in_fresh_process(<<~RUBY)
        require "herb"
        print Herb::Engine.new("<div>Hi</div>").src.include?("<div>Hi</div>") ? "compiled" : "no"
      RUBY

      assert_equal "compiled", output
    end
  end
end
