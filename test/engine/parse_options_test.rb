# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class ParseOptionsTest < Minitest::Spec
    class LocationSpy < Herb::Visitor
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

    test "location tracking is left alone when a visitor is present" do
      options = parse_options_for("<div></div>", visitors: [LocationSpy.new])

      assert_nil options[:track_locations]
    end

    test "an explicitly requested track_locations is honoured" do
      options = parse_options_for("<div></div>", parser_options: { track_locations: true })

      assert_equal true, options[:track_locations]
    end

    test "an explicitly disabled track_locations is honoured with a visitor present" do
      options = parse_options_for(
        "<div></div>",
        visitors: [LocationSpy.new],
        parser_options: { track_locations: false }
      )

      assert_equal false, options[:track_locations]
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

      assert_match(/\d+ \|/, error.message)
      assert error.diagnostics.any?
    end
  end
end
