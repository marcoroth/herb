# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    class ComponentsTest < Minitest::Spec
      FRAGMENT = <<~ERB
        <%# herb:slots client %>
        <%# herb:state (peek: "") %>
        <input value="<%= peek %>">
        <Fragment>
          <p id="card"><%= Geo.locate(peek) %></p>
          <Fallback>
            <p id="card" class="pulse">Looking it up</p>
          </Fallback>
        </Fragment>
      ERB

      def compile(source, mode: :client)
        visitor = Herb::Engine::Slots::Visitor.new(mode: mode, fatal: false)
        engine = Herb::Engine.new(source, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor, engine]
      end

      def render(engine, view = Object.new)
        view.instance_variable_set(:@output_buffer, +"")
        view.instance_eval(engine.src)
      end

      test "a fragment compiles to a conditional slot holding only the primary" do
        visitor, = compile(FRAGMENT)

        assert_equal [:attribute, :conditional, :child], visitor.slots.map(&:type)
        assert_equal [1], visitor.fragment_indexes
        assert_empty visitor.diagnostics
      end

      test "the rendered page carries the primary and never the component tags" do
        _, engine = compile(FRAGMENT)

        page = Object.new.instance_eval(engine.src.gsub("Geo.locate(peek)", "'located'"))

        assert_includes page, "located"
        refute_includes page, "<Fragment>"
        refute_includes page, "<Fallback>"
        assert_includes page, "<!--herb-slot:1:conditional-->"
      end

      test "the fallback parks in the statics container and renders its ERB once" do
        source = FRAGMENT.sub("Looking it up", "Looking up <%= @hint %> now")
        _, engine = compile(source)

        view = Object.new
        view.instance_variable_set(:@hint, "Basel")
        page = view.instance_eval(engine.src.gsub("Geo.locate(peek)", "'located'"))

        assert_includes page, "<!--herb-branch:1:1-->"
        assert_includes page, "Looking up Basel now"
      end

      test "the fallback holds no slot indexes" do
        with_hint = FRAGMENT.sub("Looking it up", "Looking up <%= @hint %> now")

        plain, = compile(FRAGMENT)
        seeded, = compile(with_hint)

        assert_equal plain.slots.map(&:type), seeded.slots.map(&:type)
      end

      test "the manifest maps the fragment to the reads inside it" do
        visitor, = compile(FRAGMENT)

        assert_equal({ "1" => { "fallback" => 1, "reads" => [2] } }, visitor.manifest["states"]["fragments"])
      end

      test "a fragment stays out of the server branch map, so no orphan warnings fire" do
        visitor, = compile(FRAGMENT)

        assert_empty visitor.manifest["states"]["server"]["branches"]
        assert_empty visitor.diagnostics
      end

      test "a fragment without a fallback unwraps, reserves no slot, and warns" do
        source = <<~ERB
          <%# herb:slots client %>
          <Fragment>
            <p><%= @value %></p>
          </Fragment>
        ERB

        visitor, = compile(source)

        assert_equal [:child], visitor.slots.map(&:type)
        assert_equal ["herb-slots-component"], visitor.diagnostics.map(&:code)
        assert_includes visitor.diagnostics.fetch(0).message, "holds no `<Fallback>`"
      end

      test "a fragment with nothing server-derived warns that the fallback can never appear" do
        source = <<~ERB
          <%# herb:slots client %>
          <%# herb:state (peek: "") %>
          <input value="<%= peek %>">
          <Fragment>
            <p><%= @value %></p>
            <Fallback><p>waiting</p></Fallback>
          </Fragment>
        ERB

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "its `<Fallback>` can never appear"
      end

      test "a fragment on a template with no states warns the same way" do
        source = <<~ERB
          <%# herb:slots client %>
          <Fragment>
            <p><%= @value %></p>
            <Fallback><p>waiting</p></Fallback>
          </Fragment>
        ERB

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "its `<Fallback>` can never appear"
      end

      test "a fallback outside a fragment errors" do
        visitor, = compile(%(<%# herb:slots client %>\n<Fallback><p>alone</p></Fallback>))

        assert_equal ["herb-slots-component"], visitor.diagnostics.map(&:code)
        assert_includes visitor.diagnostics.first.message, "outside a `<Fragment>`"
      end

      test "two fallbacks in one fragment error" do
        source = <<~ERB
          <%# herb:slots client %>
          <Fragment>
            <p><%= @value %></p>
            <Fallback><p>one</p></Fallback>
            <Fallback><p>two</p></Fallback>
          </Fragment>
        ERB

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "can only stand one in"
      end

      test "an unknown component errors and lists the built-ins" do
        visitor, = compile(%(<%# herb:slots client %>\n<Skeleton><p>x</p></Skeleton>))

        diagnostic = visitor.diagnostics.fetch(0)

        assert_equal "herb-slots-component", diagnostic.code
        assert_includes diagnostic.message, "`<Skeleton>` is not a component"
        assert_includes diagnostic.suggestion.to_s, "`<Fragment>`"
      end

      test "an unknown attribute on a fragment errors" do
        visitor, = compile(%(<%# herb:slots client %>\n<Fragment id="x"><p><%= @a %></p><Fallback>f</Fallback></Fragment>))

        assert_includes visitor.diagnostics.map(&:message).join, "only takes `delay` and `hold`"
      end

      test "attributes on a fallback error" do
        visitor, = compile(%(<%# herb:slots client %>\n<Fragment><p><%= @a %></p><Fallback delay="150">f</Fallback></Fragment>))

        assert_includes visitor.diagnostics.map(&:message).join, "takes no attributes"
      end

      test "delay and hold flow into the manifest" do
        source = FRAGMENT.sub("<Fragment>", %(<Fragment delay="0" hold="600">))

        visitor, = compile(source)

        assert_empty visitor.diagnostics
        assert_equal({ "1" => { "fallback" => 1, "reads" => [2], "delay" => 0, "hold" => 600 } }, visitor.manifest["states"]["fragments"])
      end

      test "the `on` attribute names the masking states" do
        source = FRAGMENT.sub("<Fragment>", %(<Fragment on="peek">))

        visitor, = compile(source)

        assert_empty visitor.diagnostics
        assert_equal ["peek"], visitor.manifest["states"]["fragments"]["1"]["on"]
      end

      test "an empty `on` errors" do
        source = FRAGMENT.sub("<Fragment>", %(<Fragment on="">))

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "names none"
      end

      test "a timing attribute that is not a whole number errors" do
        source = FRAGMENT.sub("<Fragment>", %(<Fragment delay="fast">))

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "takes a whole number of milliseconds"
      end

      test "a dynamic timing attribute errors" do
        source = FRAGMENT.sub("<Fragment>", %(<Fragment hold="<%= wait %>">))

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "takes a whole number of milliseconds"
      end

      test "compiler-stamped data-herb attributes on a component pass" do
        source = FRAGMENT
                 .sub("<Fragment>", %(<Fragment data-herb-source="app/views/test.html.erb:4">))
                 .sub("<Fallback>", %(<Fallback data-herb-source="app/views/test.html.erb:6">))

        visitor, = compile(source)

        assert_equal [:attribute, :conditional, :child], visitor.slots.map(&:type)
        assert_empty visitor.diagnostics
      end

      test "a fragment nested inside a fallback errors" do
        source = <<~ERB
          <%# herb:slots client %>
          <Fragment>
            <p><%= @a %></p>
            <Fallback>
              <Fragment><p>inner</p></Fragment>
            </Fallback>
          </Fragment>
        ERB

        visitor, = compile(source)

        assert_includes visitor.diagnostics.map(&:message).join, "renders once and stays static"
      end

      test "all-caps markup stays literal HTML" do
        visitor, engine = compile(%(<%# herb:slots client %>\n<DIV><%= @a %></DIV>))

        view = Object.new
        view.instance_variable_set(:@a, "x")

        assert_empty(visitor.diagnostics.select { |diagnostic| diagnostic.code == "herb-slots-component" })
        assert_includes view.instance_eval(engine.src), "<DIV"
      end

      test "a template without the slots directive leaves capitalized tags alone" do
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false, mark: false)
        engine = Herb::Engine.new(%(<Widget><p>plain</p></Widget>), visitors: [visitor], filename: "app/views/test.html.erb")

        assert_empty visitor.diagnostics
        assert_includes Object.new.instance_eval(engine.src), "<Widget>"
      end
    end
  end
end
