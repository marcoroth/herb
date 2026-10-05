# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class StrictLocalsTest < Minitest::Spec
    STRICT_LOCALS = { parser_options: { strict_locals: true } }.freeze

    def render(template, options = {})
      eval(Herb::Engine.new(template, **options).src) # rubocop:disable Security/Eval
    end

    test "strict locals without defaults compile to nothing" do
      template = %(<%# locals: (name:) %>\n<p>hi</p>\n)

      assert_equal "<p>hi</p>\n", render(template, STRICT_LOCALS)
    end

    test "strict locals with a literal default compile to nothing" do
      template = %(<%# locals: (name:, greeting: "hello") %>\n<p>hi</p>\n)

      assert_equal "<p>hi</p>\n", render(template, STRICT_LOCALS)
    end

    test "strict locals with an expression default compile to nothing" do
      template = %(<%# locals: (name:, greeting: name.to_s) %>\n<p>hi</p>\n)

      assert_equal "<p>hi</p>\n", render(template, STRICT_LOCALS)
    end

    test "strict locals compile the same with and without the strict_locals parser option" do
      template = %(<%# locals: (name:, greeting: "hello") %>\n<p>hi</p>\n)

      assert_equal Herb::Engine.new(template).src, Herb::Engine.new(template, **STRICT_LOCALS).src
    end
  end
end
