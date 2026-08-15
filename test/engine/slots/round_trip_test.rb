# frozen_string_literal: true

require "json"

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/dynamics_compiler"

module Engine
  module Slots
    # The two halves agree if a page rendered with one set of values, given another set, becomes the
    # page the server would have rendered from those values. Nothing here can prove that, because
    # applying values is the browser's half, so this writes down what the compiler produced and the
    # runtime's `round-trip.test.ts` reads it back and applies it.
    #
    # The fixture is committed rather than generated at test time so that the two suites can run
    # apart, and asserted here so that it cannot quietly stop describing the compiler.
    class RoundTripTest < Minitest::Spec
      FILE = "app/views/greet.html.erb"
      FIXTURE = File.expand_path("../../../javascript/packages/client/test/fixtures/round-trip.json", __dir__)

      TEMPLATE = <<~ERB.chomp
        <div class="<%= @tone %>"><h1><%= @title %></h1><ul><% @items.each do |item| %><li id="<%= item[:id] %>"><%= item[:label] %></li><% end %></ul><% if @admin %><b><%= @secret %></b><% else %><b><%= @public %></b><% end %></div>
      ERB

      BEFORE = {
        tone: "calm", title: "Hello", admin: true, secret: "kept", public: "shown",
        items: [{ id: "1", label: "one" }, { id: "2", label: "two" }],
      }.freeze

      AFTER = {
        tone: "loud", title: "Goodbye", admin: false, secret: "kept", public: "shown",
        items: [{ id: "1", label: "ONE" }, { id: "2", label: "TWO" }],
      }.freeze

      class View
        def initialize(**assigns)
          assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
        end
      end

      def render(assigns)
        source = Herb::Engine.new(TEMPLATE, visitors: [Herb::Engine::SlotVisitor.new], filename: FILE).src

        View.new(**assigns).instance_eval(source)
      end

      def values(assigns)
        source = Herb::Engine::DynamicsCompiler.new(TEMPLATE, filename: FILE).src

        View.new(**assigns).instance_eval(source)
      end

      def fixture
        {
          file: FILE,
          template: TEMPLATE,
          rendered: render(BEFORE),
          values: values(AFTER),
          expected: render(AFTER),
        }
      end

      test "the fixture the runtime round trips against is the one the compiler produces" do
        generated = "#{JSON.pretty_generate(fixture)}\n"

        File.write(FIXTURE, generated) if ENV["UPDATE_SNAPSHOTS"] || ENV["FORCE_UPDATE_SNAPSHOTS"]

        assert_equal generated, File.read(FIXTURE),
                     "the committed fixture no longer describes this template, re-run with UPDATE_SNAPSHOTS=1"
      end

      test "both renderings carry the same version, which is what makes the values applicable" do
        version = values(AFTER)[:version]

        assert_includes render(BEFORE), ":#{version}:"
        assert_includes render(AFTER), ":#{version}:"
      end

      test "every value that changed is named by the payload" do
        changed = values(AFTER)[:slots]

        assert_equal "loud", changed[0]
        assert_equal "Goodbye", changed[1]
        assert_equal "ONE", changed[2][:rows]["1"][4]
        assert_equal "shown", changed[5]
      end

      test "a conditional whose branches lay out the same arrives as a value, not a branch" do
        refute_includes render(BEFORE), "herb-branch"
        assert_kind_of String, values(AFTER)[:slots][5]
      end
    end
  end
end
