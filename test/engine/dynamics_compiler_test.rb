# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine/dynamics_compiler"

module Engine
  class DynamicsCompilerTest < Minitest::Spec
    class View
      def initialize(**assigns)
        assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
      end

      def form_with(**) = "<form>#{yield(Field.new)}</form>"

      def wrapper = "[#{yield}]"

      def helper_with_argument(value) = "helper(#{value})"

      User = Struct.new(:name)

      class Field
        def label = "Name"
      end
    end

    def dynamics(source, **assigns)
      compiled = Herb::Engine::DynamicsCompiler.new(source, filename: "app/views/test.html.erb").src

      View.new(**assigns).instance_eval(compiled)
    end

    describe "what it collects" do
      test "one value per expression" do
        assert_equal ["Hello"], dynamics("<h1><%= @title %></h1>", title: "Hello")
      end

      test "nothing for a template with no expressions" do
        assert_empty dynamics("<h1>Static only</h1>")
      end

      test "the value of an expression that is not written as markup" do
        assert_equal ["helper(1)"], dynamics("<%= helper_with_argument(1) %>")
      end

      test "values in the order the template evaluates them" do
        assert_equal ["a", "b", "c"], dynamics("<%= @a %><p><%= @b %></p><%= @c %>", a: "a", b: "b", c: "c")
      end
    end

    describe "what the control flow decides" do
      # Both branches keep their own index, so flipping the condition changes which entries are
      # filled and never what an entry means.
      test "leaves a tag in a branch that did not run empty" do
        source = "<% if @admin %><%= @secret %><% else %><%= @public %><% end %>"

        assert_equal [nil, "p"], dynamics(source, admin: false, secret: "s", public: "p")
        assert_equal ["s", nil], dynamics(source, admin: true, secret: "s", public: "p")
      end

      test "keeps its length whatever the condition decides" do
        source = "<% if @admin %><%= @secret %><% else %><%= @public %><% end %>"

        assert_equal 2, dynamics(source, admin: false, secret: "s", public: "p").length
        assert_equal 2, dynamics(source, admin: true, secret: "s", public: "p").length
      end

      # A loop is the one place the shape depends on the render, because how many iterations there
      # are is not known until it runs. The index still belongs to the tag.
      test "collects a tag inside a loop into one entry per iteration" do
        users = [View::User.new("A"), View::User.new("B"), View::User.new("C")]

        assert_equal [["A", "B", "C"]],
                     dynamics("<% @users.each do |u| %><li><%= u.name %></li><% end %>", users: users)
      end

      test "leaves a loop that never ran empty rather than absent" do
        assert_equal [nil], dynamics("<% @users.each do |u| %><%= u.name %><% end %>", users: [])
      end

      test "gives each tag in a loop body its own entry" do
        users = [View::User.new("A"), View::User.new("B")]
        source = "<% @users.each do |u| %><%= u.name %><%= u.name.downcase %><% end %>"

        assert_equal [["A", "B"], ["a", "b"]], dynamics(source, users: users)
      end

      test "a statement that assigns is still run" do
        assert_equal ["42"], dynamics("<% total = 40 + 2 %><span><%= total %></span>")
      end
    end

    # A value is going back to the place it was written, so it carries that place's escaping. This
    # is what is lost if the markup is stripped from the tree before compiling.
    describe "how values are escaped" do
      test "escapes an attribute value as an attribute" do
        assert_equal ["/a?b=1&amp;c=2"], dynamics(%(<a href="<%= @url %>"></a>), url: "/a?b=1&c=2")
      end

      test "escapes script content as JavaScript" do
        assert_equal ["\\x3cb\\x3e"], dynamics("<script>var x = <%= @raw %>;</script>", raw: "<b>")
      end

      test "leaves text content to the engine's own escaping" do
        assert_equal ["<b>"], dynamics("<p><%= @raw %></p>", raw: "<b>")
      end
    end

    describe "tags that take a block" do
      test "collects the whole block as one value" do
        source = %(<div><%= form_with(model: @user) do |f| %><span><%= f.label %></span><% end %></div>)

        assert_equal ["<form><span>Name</span></form>"], dynamics(source)
      end

      # Without a buffer of its own the block would collect into the list of values and return it,
      # which renders as the array rather than as its own markup.
      test "keeps the block's markup out of the values" do
        source = %(<div><%= form_with(model: @user) do |f| %><span><%= f.label %></span><% end %></div>)

        refute_includes dynamics(source), "Name"
      end

      test "nests" do
        source = %(<%= wrapper do %>a<%= form_with(model: 1) do |f| %><%= f.label %><% end %><% end %>)

        assert_equal ["[a<form>Name</form>]"], dynamics(source)
      end
    end

    describe "what it compiles to" do
      test "collects into an Array rather than a String" do
        assert_includes Herb::Engine::DynamicsCompiler.new("<p>x</p>").src, "__herb_dynamics = ::Array.new"
      end

      test "names its buffers so a template's own locals cannot collide" do
        source = %(<%= form_with(model: 1) do |f| %><%= f.label %><% end %>)
        compiled = Herb::Engine::DynamicsCompiler.new(source).src

        assert_includes compiled, "__herb_block1"
        refute_includes compiled, "_buf"
      end

      test "leaves the static markup out" do
        refute_includes Herb::Engine::DynamicsCompiler.new("<p>hello</p>").src, "hello"
      end
    end
  end
end
