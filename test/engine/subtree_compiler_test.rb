# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine/slots/subtree_compiler"

module Engine
  class SubtreeCompilerTest < Minitest::Spec
    class View
      attr_reader :ran

      def initialize(**assigns)
        assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }

        @ran = []
      end

      def track(value)
        @ran << value

        value
      end
    end

    TEMPLATE = <<~ERB.chomp
      <% total = track("assigned") %>
      <div><%= track(@title) %></div>
      <ul><li><%= total %></li></ul>
    ERB

    def compile(source, path)
      Herb::Engine::Slots::SubtreeCompiler.new(source, node_path: path, filename: "app/views/test.html.erb").src
    end

    def render(source, path, **assigns)
      View.new(**assigns).instance_eval(compile(source, path))
    end

    def side_effects(source, path, **assigns)
      view = View.new(**assigns)
      view.instance_eval(compile(source, path))

      view.ran
    end

    describe "what it renders" do
      test "the element the path names and nothing around it" do
        assert_equal "<p>b</p>", render("<div><p>a</p><p>b</p></div>", [0, 1])
      end

      test "the whole document for an empty path" do
        assert_equal "<div><p>a</p></div>", render("<div><p>a</p></div>", [])
      end

      test "the same output as the engine itself for an empty path" do
        source = %(<div class="a"><%= @x %><span>t</span><% if @on %>y<% end %></div>)
        assigns = { x: "X", on: true }

        assert_equal View.new(**assigns).instance_eval(Herb::Engine.new(source).src),
                     render(source, [], **assigns)
      end

      test "an element nested several levels down" do
        assert_equal "<b>x</b>", render("<div><section><p><b>x</b></p></section></div>", [0, 0, 0, 0])
      end

      test "an ERB tag named directly rather than an element" do
        assert_equal "X", render("<div>a<%= @x %></div>", [0, 1], x: "X")
      end
    end

    describe "what still runs" do
      test "a local assigned before the target is still assigned" do
        assert_equal "<ul><li>assigned</li></ul>", render(TEMPLATE, [4], title: "T")
      end

      test "an expression outside the target still evaluates" do
        assert_equal ["assigned", "T"], side_effects(TEMPLATE, [4], title: "T")
      end

      test "the output of everything outside the target is thrown away" do
        refute_includes render(TEMPLATE, [4], title: "T"), "T"
      end
    end

    describe "control flow around the target" do
      test "renders the target once per iteration of a loop it sits in" do
        source = "<% @xs.each do |x| %><li><%= x %></li><% end %>"

        assert_equal "<li>a</li><li>b</li>", render(source, [0, 0], xs: ["a", "b"])
      end

      test "renders nothing when the branch the target sits in did not run" do
        source = "<% if @on %><p><%= @x %></p><% end %>"

        assert_empty render(source, [0, 0], on: false, x: "X")
      end

      test "renders the target when its branch did run" do
        source = "<% if @on %><p><%= @x %></p><% end %>"

        assert_equal "<p>X</p>", render(source, [0, 0], on: true, x: "X")
      end
    end

    describe "escaping" do
      test "escapes an attribute value as an attribute" do
        assert_equal %(<a href="/a?b=1&amp;c=2">t</a>),
                     render(%(<div><a href="<%= @url %>">t</a></div>), [0, 0], url: "/a?b=1&c=2")
      end

      test "leaves text content to the engine's own escaping" do
        assert_equal "<p><b></p>", render("<div><p><%= @raw %></p></div>", [0, 0], raw: "<b>")
      end

      test "escapes script content as JavaScript" do
        assert_equal "<script>var x = \\x3cb\\x3e;</script>",
                     render("<div><script>var x = <%= @raw %>;</script></div>", [0, 0], raw: "<b>")
      end
    end

    describe "a path that leads nowhere" do
      test "says so rather than compiling a template that renders nothing" do
        error = assert_raises(Herb::Engine::Slots::SubtreeCompiler::TargetNotFound) do
          compile("<div><p>a</p></div>", [9])
        end

        assert_includes error.message, "[9]"
      end

      test "does not treat an open tag as a position" do
        assert_raises(Herb::Engine::Slots::SubtreeCompiler::TargetNotFound) do
          compile(%(<div class="a" id="b">x</div>), [0, 1])
        end
      end
    end

    describe "what it compiles to" do
      test "keeps the discarded output out of the buffer it returns" do
        compiled = compile("<div>outside<p>inside</p></div>", [0, 1])

        assert_includes compiled, "__herb_sink << '<div>outside'"
        assert_includes compiled, "__herb_subtree << '<p>inside</p>'"
      end

      test "returns the subtree buffer rather than the sink" do
        assert_match(/__herb_subtree\s*\z/, compile("<div><p>x</p></div>", [0, 0]))
      end
    end
  end
end
