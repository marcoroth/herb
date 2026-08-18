# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class CompilerClassTest < Minitest::Spec
    class TextlessCompiler < Herb::Engine::Compiler
      private

      def add_text(text); end
    end

    class TextlessEngine < Herb::Engine
      def compiler_class
        TextlessCompiler
      end
    end

    class CountingEngine < Herb::Engine
      def self.asked
        @asked ||= 0
      end

      class << self
        attr_writer :asked
      end

      def compiler_class
        self.class.asked += 1

        super
      end
    end

    describe "which compiler walks the AST" do
      test "the engine's own one by default" do
        assert_equal Herb::Engine.new("<p>hello</p>").src, %(_buf = ::String.new; _buf << '<p>hello</p>'.freeze;\n_buf.to_s\n)
      end

      test "asks for it rather than naming it" do
        CountingEngine.asked = 0
        CountingEngine.new("<p>hello</p>")

        assert_equal 1, CountingEngine.asked
      end

      test "the one a subclass names" do
        assert_equal TextlessEngine.new("<p>hello</p>").src, %(_buf = ::String.new;\n_buf.to_s\n)
      end

      test "the replacement drives the whole walk, not only the part it changed" do
        assert_equal TextlessEngine.new("<p><%= @title %></p>").src, %(_buf = ::String.new; _buf << (@title).to_s;\n_buf.to_s\n)
      end

      test "leaves the engine's own compiler alone for everything else" do
        TextlessEngine.new("<p>hello</p>")

        assert_equal Herb::Engine.new("<p>hello</p>").src, %(_buf = ::String.new; _buf << '<p>hello</p>'.freeze;\n_buf.to_s\n)
      end
    end
  end
end
