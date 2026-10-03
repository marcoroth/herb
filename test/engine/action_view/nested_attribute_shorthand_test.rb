# frozen_string_literal: true

require_relative "action_view_test_helper"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module ActionView
    class NestedAttributeShorthandTest < Minitest::Spec
      include ActionViewTestHelper

      test "nested data shorthand reads local variables" do
        template = '<% src = "/events?organization=all"; count = 3 %><%= tag.div data: { src:, count: } %>'

        assert_optimized_output_match(template)
      end

      test "nested data and aria shorthand reads method values" do
        template = "<%= tag.div data: { controller:, payload:, labels: }, aria: { expanded: } %>"

        assert_optimized_output_match(template, {
          controller: "editor",
          payload: { id: 7 },
          labels: ["first", "second"],
          expanded: false,
        })
      end

      test "nested shorthand retains underscores in the Ruby expression" do
        template = "<%= tag.div data: { user_name: }, aria: { described_by: } %>"

        assert_optimized_output_match(template, { user_name: "Alice", described_by: "help" })
      end

      test "slots compile nested shorthand as a value rather than a keyword hash" do
        template = '<%= turbo_frame_tag "f", data: { src: } %>'
        engine = Herb::Engine.new(template, visitors: [Herb::Engine::Slots::Visitor.new(mode: :server)])
        rendered = action_view_eval(engine.src, { src: "/events?organization=all" })
        frame = Nokogiri::HTML.fragment(rendered).at_css("turbo-frame")

        assert_equal "/events?organization=all", frame["data-src"]
      end
    end
  end
end
