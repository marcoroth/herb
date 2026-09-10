# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/visitors/instrumentation_visitor"

module Engine
  module Slots
    class InstrumentationTest < Minitest::Spec
      include SnapshotUtils

      TEMPLATE = <<~ERB
        <%# herb:slots client %>
        <h2><%= @title %></h2>
        <p class="<%= @tone %>">
          <%= @summary %>
        </p>
        <% if @open %>
          <span><%= @detail %></span>
        <% end %>
      ERB

      def compile(template, instrumented:)
        slots = Herb::Engine::Slots::Visitor.new(mode: :client)
        visitors = instrumented ? [slots, Herb::Engine::InstrumentationVisitor.new] : [slots]

        [Herb::Engine.new(template, visitors: visitors, filename: "app/views/test.html.erb").src, slots]
      end

      def anchors_in(source)
        source.scan(/data-herb-slot=\\"[^"]*\\"|<!--herb-slot:\d+[^>]*-->/).sort
      end

      test "instrumentation after slots keeps every marker and anchor" do
        plain, = compile(TEMPLATE, instrumented: false)
        instrumented, = compile(TEMPLATE, instrumented: true)

        assert_equal anchors_in(plain), anchors_in(instrumented)
      end

      test "the instrumented page compile keeps its markers" do
        instrumented, = compile(TEMPLATE, instrumented: true)

        assert_snapshot_matches(instrumented, TEMPLATE, { visitors: "slots, instrumentation" })
      end
    end
  end
end
