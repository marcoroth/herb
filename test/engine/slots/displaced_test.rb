# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slot_visitor"

module Engine
  module Slots
    # `content_for` and `capture` run during one rendering and hand their markup to whoever wants it,
    # which is usually somewhere else on the page. The markers go with it, so a slot ends up outside
    # the markers of the template that numbered it, and anything attributing slots by where they sit
    # gives it to whatever encloses it instead.
    #
    # So captured markup carries the rendering it came from, written around it, and carries it by
    # reading the number rather than counting again, since counting again would say it was a
    # different rendering.
    #
    # Where the markup ends up is ActionView's business and is not tested here. What is tested is
    # that it leaves with everything needed to say where it belongs.
    class DisplacedTest < Minitest::Spec
      FILE = "app/views/page/show.html.erb"

      class View
        def initialize(**assigns)
          assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
        end

        def content_for(_name) = yield
        def capture = yield
        def provide(_name) = yield
        def wrapper = yield
        def capture_panel = yield
      end

      def compile(source)
        Herb::Engine.new(source, visitors: [Herb::Engine::SlotVisitor.new], filename: FILE).src
      end

      def render(source, **assigns)
        View.new(**assigns).instance_eval(compile(source))
      end

      def openers(markup)
        markup.scan(/<!--herb-region:([^:]+):([0-9a-f]+):(\d+)-->/)
      end

      test "writes a second region marker around what the helper captured" do
        markup = render("<% content_for :title do %><h1><%= @title %></h1><% end %>", title: "T")

        assert_equal 2, openers(markup).size
      end

      test "names the rendering it came from, rather than counting a new one" do
        markup = render("<% content_for :title do %><h1><%= @title %></h1><% end %><p><%= @body %></p>", title: "T", body: "B")
        outer, inner = openers(markup)

        assert_equal outer, inner
        assert_equal "0", inner.last
      end

      test "both halves of a second rendering agree that they are the second" do
        compiled = compile("<% content_for :title do %><h1><%= @title %></h1><% end %><p><%= @body %></p>")
        view = View.new(title: "T", body: "B")

        assert_equal [["0", "0"], ["1", "1"]], Array.new(2) { openers(view.instance_eval(compiled)).map(&:last) }
      end

      test "the slots inside it keep the numbering of the template that wrote them" do
        markup = render("<% content_for :title do %><h1><%= @title %></h1><% end %><p><%= @body %></p>", title: "T", body: "B")

        assert_includes markup, %(<h1 data-herb-child="1">)
        assert_includes markup, %(<p data-herb-child="2">)
      end

      test "capture is wrapped too, being the same displacement by another name" do
        assert_equal 2, openers(render("<% @held = capture do %><b><%= @name %></b><% end %>", name: "N")).size
      end

      test "provide is wrapped too" do
        assert_equal 2, openers(render("<% provide :title do %><b><%= @name %></b><% end %>", name: "N")).size
      end

      # A helper that renders its block in place needs no second marker, and matching every block
      # would put one around every `form_with` on the page.
      test "a block that captures nothing is left alone" do
        assert_equal 1, openers(render("<% wrapper do %><b><%= @name %></b><% end %>", name: "N")).size
      end

      test "a name that merely begins with one of them is not a capture" do
        assert_equal 1, openers(render("<% capture_panel do %><b><%= @name %></b><% end %>", name: "N")).size
      end
    end
  end
end
