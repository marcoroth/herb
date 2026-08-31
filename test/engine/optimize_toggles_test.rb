# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require "herb/engine/visitors/optimize_visitor"

module Engine
  class OptimizeTogglesTest < Minitest::Spec
    include SnapshotUtils

    def optimize_options(toggles = {}, **options)
      { visitors: [Herb::Engine::OptimizeVisitor.new(**toggles)], **options }
    end

    describe "the helpers pass" do
      test "left off, a helper call stays for the renderer to make" do
        assert_compiled_snapshot("<p><%= tag.br %></p>", optimize_options({ helpers: false }))
      end

      test "left off, it does not stand between the caller and the parser option" do
        assert_compiled_snapshot(
          "<p><%= tag.br %></p>",
          optimize_options({ helpers: false }, parser_options: { action_view_helpers: true })
        )
      end

      test "left off, verify finds nothing to guard" do
        assert_compiled_snapshot("<p><%= tag.br %></p>", optimize_options({ helpers: false, verify: true }))
      end
    end

    describe "the conditionals pass" do
      test "left off alone, helpers still bring the unroll with them" do
        assert_compiled_snapshot(%(<p><%= "yes" if flag %></p>), optimize_options({ conditionals: false }))
      end

      test "left off with helpers, a statement modifier stays the expression it was written as" do
        assert_compiled_snapshot(%(<p><%= "yes" if flag %></p>), optimize_options({ helpers: false, conditionals: false }))
      end
    end

    describe "the literals pass" do
      test "left off, a literal output stays dynamic" do
        assert_compiled_snapshot(%(<h1><%= "hello" %></h1>), optimize_options({ literals: false }))
      end

      test "left off, helpers still resolve" do
        assert_compiled_snapshot(%(<p><%= tag.br %><%= "text" %></p>), optimize_options({ literals: false }))
      end

      test "left off, a template the helpers made static still collapses" do
        assert_compiled_snapshot("<p><%= tag.br %></p>", optimize_options({ literals: false }))
      end
    end

    describe "the collapse pass" do
      test "left off, an HTML-only template keeps the buffer" do
        assert_compiled_snapshot("<div>Static</div>", optimize_options({ collapse: false }))
      end

      test "left off, a conditional chain keeps the buffer" do
        assert_compiled_snapshot(
          "<% if signed_in? %><p>Hello</p><% else %><p>Bye</p><% end %>",
          optimize_options({ collapse: false })
        )
      end

      test "left off, literals still fold into the text around them" do
        assert_compiled_snapshot(%(<h1><%= "hello" %></h1>), optimize_options({ collapse: false }))
      end
    end

    describe "what inspect names" do
      test "default construction names no toggles" do
        assert_equal "#<Herb::Engine::OptimizeVisitor>", Herb::Engine::OptimizeVisitor.new.inspect
      end

      test "verify keeps the inspect it had" do
        assert_equal "#<Herb::Engine::OptimizeVisitor verify=true>", Herb::Engine::OptimizeVisitor.new(verify: true).inspect
      end

      test "a pass left off is named" do
        assert_equal "#<Herb::Engine::OptimizeVisitor helpers=false>", Herb::Engine::OptimizeVisitor.new(helpers: false).inspect
      end

      test "every non-default toggle is named" do
        visitor = Herb::Engine::OptimizeVisitor.new(helpers: false, conditionals: false, literals: false, collapse: false, verify: true)

        assert_equal "#<Herb::Engine::OptimizeVisitor helpers=false conditionals=false literals=false collapse=false verify=true>", visitor.inspect
      end
    end

    describe "what the parser is asked for" do
      test "every pass on requires both parser options" do
        options = Herb::Engine::OptimizeVisitor.new.required_parser_options

        assert_equal({ action_view_helpers: true, transform_conditionals: true }, options)
      end

      test "helpers left off drops its parser option" do
        options = Herb::Engine::OptimizeVisitor.new(helpers: false).required_parser_options

        assert_equal({ transform_conditionals: true }, options)
      end

      test "conditionals left off drops its parser option" do
        options = Herb::Engine::OptimizeVisitor.new(conditionals: false).required_parser_options

        assert_equal({ action_view_helpers: true }, options)
      end

      test "verify keeps requiring locations with the parser passes off" do
        options = Herb::Engine::OptimizeVisitor.new(helpers: false, conditionals: false, verify: true).required_parser_options

        assert_equal({ track_locations: true }, options)
      end
    end
  end
end
