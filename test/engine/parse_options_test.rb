# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class ParseOptionsTest < Minitest::Spec
    class LocationSpy < Herb::Visitor
      required_parser_option track_locations: true

      attr_reader :elements, :missing_locations

      def initialize
        super

        @elements = 0
        @missing_locations = 0
      end

      def visit_html_element_node(node)
        @elements += 1
        @missing_locations += 1 if node.location.nil?

        super
      end
    end

    def parse_options_for(source, **properties)
      Herb::Engine.new(source, **properties).send(:parse_options)
    end

    test "location tracking is skipped when no visitor can observe it" do
      assert_equal false, parse_options_for("<div></div>")[:track_locations]
    end

    test "a visitor that needs locations turns tracking back on" do
      options = parse_options_for("<div></div>", visitors: [LocationSpy.new])

      assert_equal true, options[:track_locations]
    end

    test "a visitor that never reads a location leaves tracking off" do
      options = parse_options_for("<div></div>", visitors: [Class.new(Herb::Visitor).new])

      assert_equal false, options[:track_locations]
    end

    test "reporting diagnostics is enough to need locations" do
      reporter = Class.new(Herb::Visitor) do
        include Herb::Visitor::Diagnostics
      end

      options = parse_options_for("<div></div>", visitors: [reporter.new])

      assert_equal true, options[:track_locations]
    end

    test "an explicitly requested track_locations is honoured" do
      options = parse_options_for("<div></div>", parser_options: { track_locations: true })

      assert_equal true, options[:track_locations]
    end

    test "a visitor requiring locations conflicts with disabling them" do
      assert_raises(ArgumentError) do
        parse_options_for(
          "<div></div>",
          visitors: [LocationSpy.new],
          parser_options: { track_locations: false }
        )
      end
    end

    test "a visitor still receives node locations" do
      spy = LocationSpy.new

      Herb::Engine.new("<div><p>Content</p></div>", visitors: [spy])

      assert_equal 2, spy.elements
      assert_equal 0, spy.missing_locations
    end

    test "compiled output does not depend on location tracking" do
      source = <<~ERB
        <div class="foo">
          <% if condition %>
            <%= value %>
          <% end %>
        </div>
      ERB

      tracked = Herb::Engine.new(source, parser_options: { track_locations: true }).src

      assert_equal tracked, Herb::Engine.new(source).src
    end

    test "a parse error still reports its location" do
      error = assert_raises(Herb::Engine::ParseError) do
        Herb::Engine.new("<div><span></div>")
      end

      location = error.diagnostics.first&.location

      refute_nil location
      assert_equal 1, location.start.line
      assert_equal 5, location.start.column
    end

    describe "the strict option" do
      def omitted_closing_tag
        <<~ERB
          <div>
            <span>
              <p>Text
            </span>
          </div>
        ERB
      end

      test "reaches the parser through the parser options" do
        assert_equal false, parse_options_for("<div></div>", parser_options: { strict: false })[:strict]
        assert_equal true, parse_options_for("<div></div>", parser_options: { strict: true })[:strict]
      end

      test "says nothing about strict when it was not asked about" do
        refute parse_options_for("<div></div>").key?(:strict)
      end

      test "an omitted closing tag is an error under strict" do
        assert_raises(Herb::Engine::ParseError) do
          Herb::Engine.new(omitted_closing_tag, parser_options: { strict: true })
        end
      end

      test "and is allowed without it" do
        assert_instance_of Herb::Engine, Herb::Engine.new(omitted_closing_tag, parser_options: { strict: false })
      end

      test "a strict beside the parser options is not a way to ask for it" do
        assert_raises(Herb::Engine::ParseError) do
          Herb::Engine.new(omitted_closing_tag, strict: false)
        end
      end
    end
  end
end
