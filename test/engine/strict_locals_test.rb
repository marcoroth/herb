# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class StrictLocalsTest < Minitest::Spec
    include SnapshotUtils

    test "strict locals without defaults compile to nothing" do
      template = %(<%# locals: (name:) %>\n<p>hi</p>\n)

      assert_evaluated_snapshot(template, {}, parser_options: { strict_locals: true })
    end

    test "strict locals with a literal default compile to nothing" do
      template = %(<%# locals: (name:, greeting: "hello") %>\n<p>hi</p>\n)

      assert_evaluated_snapshot(template, {}, parser_options: { strict_locals: true })
    end

    test "strict locals with an expression default compile to nothing" do
      template = %(<%# locals: (name:, greeting: name.to_s) %>\n<p>hi</p>\n)

      assert_evaluated_snapshot(template, {}, parser_options: { strict_locals: true })
    end

    test "strict locals compile the same with and without the strict_locals parser option" do
      template = %(<%# locals: (name:, greeting: "hello") %>\n<p>hi</p>\n)

      assert_equal Herb::Engine.new(template).src, Herb::Engine.new(template, parser_options: { strict_locals: true }).src
    end
  end
end
