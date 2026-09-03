# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine/slots/dynamics_compiler"

module Engine
  class DynamicsCompilerTest < Minitest::Spec
    class View
      def initialize(**assigns)
        assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
      end

      def form_with(**) = "<form>#{yield(Field.new)}</form>"

      def render(*)
        source = Herb::Engine::Slots::DynamicsCompiler.new("<b><%= @inner %></b>", filename: "app/views/card.html.erb").src

        View.new(inner: "inner").instance_eval(source)
      end

      def wrapper = "[#{yield}]"

      def helper_with_argument(value) = "helper(#{value})"

      User = Struct.new(:firstname, :lastname)

      class Field
        def label = "Name"
      end
    end

    CONDITIONAL = "<% if @admin %><b><%= @secret %></b><% else %><%= @public %><% end %>"
    PARTIAL_VERSION = Herb::Engine::Slots::DynamicsCompiler.new("<b><%= @inner %></b>").slot_visitor.version

    def payload(source, **assigns)
      compiled = Herb::Engine::Slots::DynamicsCompiler.new(source, filename: "app/views/test.html.erb").src

      View.new(**assigns).instance_eval(compiled)
    end

    class SteeredView < View
      attr_accessor :__herb_state_overrides
    end

    def steered(source, overrides, **assigns)
      compiled = Herb::Engine::Slots::DynamicsCompiler.new(source, filename: "app/views/test.html.erb").src
      view = SteeredView.new(**assigns)
      view.__herb_state_overrides = overrides

      view.instance_eval(compiled)
    end

    def dynamics(source, **assigns)
      payload(source, **assigns)[:slots]
    end

    describe "seeded item states" do
      def seeded_rows
        <<~ERB
          <%# herb:slots client %>
          <ul>
            <% @rows.each do |row| %>
              <%# herb:key row %>
              <%# herb:state (draft: row.to_s, flag: false) %>
              <li id="r<%= row %>"><%= row %></li>
            <% end %>
          </ul>
        ERB
      end

      test "each item carries the values the server seeded it with" do
        items = dynamics(seeded_rows, rows: [1, 2]).fetch(0).fetch(:items)

        assert_equal({ "draft" => "1" }, items.fetch("1").fetch(:seeds))
        assert_equal({ "draft" => "2" }, items.fetch("2").fetch(:seeds))
      end

      test "a literal default is not shipped, since the client already knows it" do
        seeds = dynamics(seeded_rows, rows: [1]).fetch(0).fetch(:items).fetch("1").fetch(:seeds)

        refute_includes seeds.keys, "flag"
      end

      test "an item with only literal defaults carries no seeds" do
        source = <<~ERB
          <%# herb:slots client %>
          <ul>
            <% @rows.each do |row| %>
              <%# herb:key row %>
              <%# herb:state (flag: false) %>
              <li id="r<%= row %>"><%= row %></li>
            <% end %>
          </ul>
        ERB

        refute_includes dynamics(source, rows: [1]).fetch(0).fetch(:items).fetch("1").keys, :seeds
      end

      test "a value the client cannot hold is dropped" do
        source = <<~ERB
          <%# herb:slots client %>
          <ul>
            <% @rows.each do |row| %>
              <%# herb:key row %>
              <%# herb:state (shape: @list, name: row.to_s) %>
              <li id="r<%= row %>"><%= row %></li>
            <% end %>
          </ul>
        ERB

        assert_equal({ "name" => "1" }, dynamics(source, rows: [1], list: [1, 2]).fetch(0).fetch(:items).fetch("1").fetch(:seeds))
      end
    end

    describe "what it collects" do
      test "one value per expression" do
        assert_equal({ 0 => "Hello" }, dynamics("<h1><%= @title %></h1>", title: "Hello"))
      end

      test "nothing for a template with no expressions" do
        assert_empty dynamics("<h1>Static only</h1>")
      end

      test "the value of an expression that is not written as markup" do
        assert_equal({ 0 => "helper(1)" }, dynamics("<%= helper_with_argument(1) %>"))
      end

      test "values in the order the template evaluates them" do
        assert_equal({ 0 => "a", 1 => "b", 2 => "c" }, dynamics("<%= @a %><p><%= @b %></p><%= @c %>", a: "a", b: "b", c: "c"))
      end

      test "a statement that assigns is still run" do
        assert_equal({ 0 => "42" }, dynamics("<% total = 40 + 2 %><span><%= total %></span>"))
      end
    end

    describe "conditionals" do
      test "names the branch that ran and nests what it rendered" do
        assert_equal({ 0 => { branch: 0, slots: { 1 => "s" } } }, dynamics(CONDITIONAL, admin: true, secret: "s", public: "p"))
      end

      test "names the other branch when the condition flips" do
        assert_equal({ 0 => { branch: 1, slots: { 2 => "p" } } }, dynamics(CONDITIONAL, admin: false, secret: "s", public: "p"))
      end

      test "counts an elsif as its own branch" do
        source = "<% if @a %>A<% elsif @b %><%= @y %><% else %><%= @z %><% end %>"

        assert_equal({ 0 => { branch: 1, slots: { 1 => "y" } } }, dynamics(source, a: false, b: true, y: "y", z: "z"))
      end

      test "counts each when of a case as its own branch" do
        source = "<% case @n %><% when 1 %><%= @a %><% when 2 %><%= @b %><% end %>"

        assert_equal({ 0 => { branch: 1, slots: { 2 => "b" } } }, dynamics(source, n: 2, a: "a", b: "b"))
      end

      test "reports a conditional that matched nothing rather than leaving it out" do
        assert_equal({ 0 => { branch: nil } }, dynamics("<% if @a %><%= @x %><% end %>", a: false, x: "x"))
      end

      test "leaves out the slots of a branch that did not run" do
        result = dynamics(CONDITIONAL, admin: true, secret: "s", public: "p")

        refute_includes result[0][:slots].keys, 2
      end

      test "reports a conditional whose branches lay out the same as one value" do
        source = "<% if @admin %><%= @secret %><% else %><%= @public %><% end %>"

        assert_equal({ 0 => "s" }, dynamics(source, admin: true, secret: "s", public: "p"))
        assert_equal({ 0 => "p" }, dynamics(source, admin: false, secret: "s", public: "p"))
      end
    end

    describe "collections" do
      test "groups by item rather than by slot" do
        users = [View::User.new("Marco", "Roth"), View::User.new("Joe", "Doe")]
        source = %(<% @users.each do |u| %><li id="<%= u.firstname %>"><%= u.lastname %></li><% end %>)

        assert_equal({ 0 => { items: { "Marco" => { 1 => "Marco", 2 => "Roth" }, "Joe" => { 1 => "Joe", 2 => "Doe" } }, order: ["Marco", "Joe"] } }, dynamics(source, users: users))
      end

      test "reports a collection that rendered no items" do
        assert_equal({ 0 => { items: {}, order: [] } }, dynamics(%(<% @users.each do |u| %><li id="<%= u %>"><%= u %></li><% end %>), users: []))
      end

      test "keeps the items of a nested collection inside the item that produced them" do
        source = %(<% @items.each do |r| %><ul id="<%= r.first %>"><% r.each do |c| %><li id="<%= c %>"><%= c %></li><% end %></ul><% end %>)

        assert_equal({ 0 => { items: { "1" => { 1 => "1", 2 => { items: { "1" => { 3 => "1", 4 => "1" }, "2" => { 3 => "2", 4 => "2" } }, order: ["1", "2"] } }, "3" => { 1 => "3", 2 => { items: { "3" => { 3 => "3", 4 => "3" } }, order: ["3"] } } }, order: ["1", "3"] } }, dynamics(source, items: [[1, 2], [3]]))
      end

      test "nests a conditional inside the item it ran in" do
        source = %(<% @xs.each_with_index do |x, i| %><li id="<%= i %>"><% if x %><%= x %><% end %></li><% end %>)

        assert_equal({ 0 => { items: { "0" => { 1 => "0", 2 => { branch: 0, slots: { 3 => "a" } } }, "1" => { 1 => "1", 2 => { branch: nil } } }, order: ["0", "1"] } }, dynamics(source, xs: ["a", nil]))
      end

      test "nests a collection inside the branch it ran in" do
        source = %(<% if @on %><% @xs.each do |x| %><li id="<%= x %>"><%= x %></li><% end %><% end %>)

        assert_equal({ 0 => { branch: 0, slots: { 1 => { items: { "a" => { 2 => "a", 3 => "a" }, "b" => { 2 => "b", 3 => "b" } }, order: ["a", "b"] } } } }, dynamics(source, on: true, xs: ["a", "b"]))
      end

      test "keys items by the key the template declared" do
        users = [View::User.new("Ada", "L"), View::User.new("Grace", "H")]
        source = %(<% @users.each do |u| %><li id="<%= u.firstname %>"><%= u.lastname %></li><% end %>)

        assert_equal({ 0 => { items: { "Ada" => { 1 => "Ada", 2 => "L" }, "Grace" => { 1 => "Grace", 2 => "H" } }, order: ["Ada", "Grace"] } }, dynamics(source, users: users))
      end

      test "reports an unkeyed collection as holding nothing addressable" do
        source = %(<% @users.each do |u| %><%= u.firstname %><% end %>)
        users = [View::User.new("Ada", "L"), View::User.new("Grace", "H")]

        assert_equal({ 0 => { items: {}, order: [] } }, dynamics(source, users: users))
      end

      test "treats a for loop as a collection" do
        assert_equal({ 0 => { items: {}, order: [] } }, dynamics("<% for x in @xs %><%= x %><% end %>", xs: ["a", "b"]))
      end
    end

    describe "how values are escaped" do
      test "escapes an attribute value as an attribute" do
        assert_equal({ 0 => "/a?b=1&amp;c=2" }, dynamics(%(<a href="<%= @url %>"></a>), url: "/a?b=1&c=2"))
      end

      test "reports nothing for script content, which has no slot to address" do
        assert_empty dynamics("<script>var x = <%= @raw %>;</script>", raw: "<b>")
      end

      test "leaves text content to the engine's own escaping" do
        assert_equal({ 0 => "<b>" }, dynamics("<p><%= @raw %></p>", raw: "<b>"))
      end
    end

    describe "tags that take a block" do
      test "collects the whole block as one value" do
        source = %(<div><%= form_with(model: @user) do |f| %><span><%= f.label %></span><% end %></div>)

        assert_equal({ 0 => "<form><span>Name</span></form>", 1 => "Name" }, dynamics(source))
      end

      test "reports what is inside it as well as the markup around it" do
        source = %(<div><%= form_with(model: @user) do |f| %><span><%= f.label %></span><% end %></div>)

        assert_equal "Name", dynamics(source)[1]
      end

      test "nests" do
        source = %(<%= wrapper do %>a<%= form_with(model: 1) do |f| %><%= f.label %><% end %><% end %>)

        assert_equal({ 0 => "[a<form>Name</form>]", 2 => "Name" }, dynamics(source))
      end

      test "takes an index of its own so the tags after it keep theirs" do
        source = %(<%= form_with(model: 1) do |f| %><%= f.label %><% end %><%= @after %>)

        assert_equal({ 0 => "<form>Name</form>", 1 => "Name", 2 => "A" }, dynamics(source, after: "A"))
      end
    end

    describe "the template it came from" do
      test "names itself, since an index means nothing without the template numbering it" do
        assert_equal "app/views/test.html.erb", payload("<p><%= @a %></p>")[:template]
      end

      test "carries the version the markers on the page were emitted with" do
        assert_match(/\A[0-9a-f]{8}\z/, payload("<p><%= @a %></p>")[:version])
      end

      test "changes version when the slots move and not when they hold something else" do
        moved = payload("<p><%= @a %></p><b><%= @b %></b>")[:version]

        assert_equal payload("<p><%= @a %></p>", a: "x")[:version], payload("<p><%= @a %></p>", a: "y")[:version]
        refute_equal payload("<p><%= @a %></p>")[:version], moved
      end
    end

    describe "rendering another template" do
      test "keeps the partial's own values rather than flattening them into a string" do
        assert_equal({ template: "app/views/card.html.erb", version: PARTIAL_VERSION, occurrence: 0, slots: { 0 => "inner" } },
                     dynamics(%(<div><%= render "card" %></div>))[0])
      end

      test "leaves the slots after it addressable" do
        assert_equal "A", dynamics(%(<div><%= render "card" %><%= @after %></div>), after: "A")[1]
      end
    end

    describe "what it compiles to" do
      test "collects into a Hash rather than a String" do
        assert_includes Herb::Engine::Slots::DynamicsCompiler.new("<p>x</p>").src, "__herb_dynamics = ::Hash.new"
      end

      test "names its buffers so a template's own locals cannot collide" do
        source = %(<%= form_with(model: 1) do |f| %><%= f.label %><% end %>)
        compiled = Herb::Engine::Slots::DynamicsCompiler.new(source).src

        assert_includes compiled, "__herb_block1"
        refute_includes compiled, "_buf"
      end

      test "leaves the static markup out" do
        refute_includes Herb::Engine::Slots::DynamicsCompiler.new("<p>hello</p>").src, "hello"
      end
    end

    STEERABLE = %(<%# herb:state (editing: false, q: "") %><% if editing %><b>on</b><% else %><i>off</i><% end %><span><%= q.length + 1 %></span>)

    describe "state overrides" do
      test "the values program initializes states through the override channel" do
        source = Herb::Engine::Slots::DynamicsCompiler.new(STEERABLE, filename: "app/views/test.html.erb").src

        assert_includes source, "StateOverrides.resolve"
        assert_includes source, %(StateOverrides.fetch(_herb_state_overrides, "editing", :boolean))
      end

      test "an override steers the branch and the dependent reads" do
        values = steered(STEERABLE, { "app/views/test.html.erb" => { "editing" => true, "q" => "abc" } })

        assert_equal 0, values[:slots][0][:branch]
        assert_equal "4", values[:slots][1]
      end

      test "no hook and no overrides both fall back to the defaults" do
        assert_equal 1, payload(STEERABLE)[:slots][0][:branch]
        assert_equal 1, steered(STEERABLE, nil)[:slots][0][:branch]
      end

      test "a wrongly typed override falls back to the default" do
        values = steered(STEERABLE, { "app/views/test.html.erb" => { "editing" => "sideways" } })

        assert_equal 1, values[:slots][0][:branch]
      end

      test "a derived state re-derives from its overridden base" do
        template = %(<%# herb:state (count: 0, loud: count > 2) %><% if loud %>a<% else %>b<% end %>)
        values = steered(template, { "app/views/test.html.erb" => { "count" => 5 } })

        assert_equal 0, values[:slots][0][:branch]
      end
    end

    describe "branch statics in the payload" do
      def parity(mode)
        <<~ERB
          <%# herb:slots #{mode} %>
          <% if @on %>
            <b>lit <%= @watts %></b>
          <% else %>
            <i>dark</i>
          <% end %>
        ERB
      end

      test "a server-mode payload brings the taken branch's markup along" do
        entry = dynamics(parity("server"), on: false).fetch(0)

        assert_equal 1, entry.fetch(:branch)
        assert_includes entry.fetch(:statics), "<i>dark</i>"

        lit = dynamics(parity("server"), on: true, watts: 60).fetch(0)

        assert_equal 0, lit.fetch(:branch)
        assert_includes lit.fetch(:statics), "<b>"
      end

      test "a client-mode payload sends no statics, since the page parks them" do
        entry = dynamics(parity("client"), on: false).fetch(0)

        refute entry.key?(:statics)
      end
    end

    KNOB = %(<%# herb:slots client %>\n<span class="knob <%= @dark ? "far" : "" %>" id="k"></span>) #: String

    describe "a conditional inside an attribute" do
      test "the payload carries the taken branch's text as the attribute's part" do
        assert_equal ["far"], dynamics(KNOB, dark: true).fetch(0)
        assert_equal [""], dynamics(KNOB, dark: false).fetch(0)
      end

      test "the slot the payload fills is the attribute the visitor modeled" do
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(KNOB, filename: "app/views/test.html.erb")

        assert_equal :attribute_interpolation, compiler.slot_visitor.slots.fetch(0).type
      end

      test "a fragment's values always take the primary branch and skip the fallback" do
        source = <<~ERB
          <%# herb:slots client %>
          <Fragment>
            <p><%= helper_with_argument(1) %></p>
            <Fallback><p>waiting for <%= @never %></p></Fallback>
          </Fragment>
        ERB

        values = dynamics(source)

        assert_equal({ 0 => { branch: 0, slots: { 1 => "helper(1)" } } }, values)
      end

      test "a fragment numbers identically in the values and page compiles" do
        source = <<~ERB
          <%# herb:slots client %>
          <span><%= @before %></span>
          <Fragment>
            <p><%= @inside %></p>
            <Fallback><p>waiting</p></Fallback>
          </Fragment>
          <em><%= @after %></em>
        ERB

        values_visitor = Herb::Engine::Slots::DynamicsCompiler.new(source, filename: "app/views/test.html.erb").slot_visitor

        page_visitor = Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)
        Herb::Engine.new(source, visitors: [page_visitor], filename: "app/views/test.html.erb")

        assert_equal(page_visitor.slots.map { |slot| [slot.index, slot.type] }, values_visitor.slots.map { |slot| [slot.index, slot.type] })
      end

      test "a whole-value attribute conditional assigns the scalar the visitor expects" do
        source = %(<%# herb:slots client %>\n<span class="<%= @on ? "is-\#{@tone}" : "off" %>"></span>)

        assert_equal "is-calm", dynamics(source, on: true, tone: "calm").fetch(0)
        assert_equal "off", dynamics(source, on: false).fetch(0)
      end
    end
  end
end
