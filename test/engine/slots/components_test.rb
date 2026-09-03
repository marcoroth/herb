# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    class ComponentsTest < Minitest::Spec
      include SnapshotUtils

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

      PAGE = <<~ERB
        <%# herb:slots client %>
        <%# herb:state (peek: "basel") %>
        <input value="<%= peek %>">
        <Fragment>
          <p id="card">located <%= peek.upcase %></p>
          <Fallback>
            <p id="card" class="pulse">Looking up <%= @hint %> now</p>
          </Fallback>
        </Fragment>
      ERB

      def compile(source, mode: :client)
        visitor = Herb::Engine::Slots::Visitor.new(mode: mode, fatal: false)
        engine = Herb::Engine.new(source, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor, engine]
      end

      def page_options
        { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)], filename: "app/views/test.html.erb" }
      end

      test "a fragment compiles to a conditional slot holding only the primary" do
        visitor, = compile(FRAGMENT)

        assert_equal [:attribute, :conditional, :child], visitor.slots.map(&:type)
        assert_equal [1], visitor.fragment_indexes
        assert_empty visitor.diagnostics
      end

      test "the compiled program holds the fragment as a conditional and no component tags" do
        _, engine = compile(PAGE)

        assert_snapshot_matches(engine.src, PAGE, { mode: "client" })
      end

      test "the rendered page shows the primary and parks the fallback with its ERB evaluated" do
        assert_evaluated_snapshot(PAGE, { "@hint" => "Basel" }, page_options)
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
        assert_equal ["`<Fragment>` holds no `<Fallback>`, so it wraps nothing and compiles away."], visitor.diagnostics.map(&:message)
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

        assert_equal ["Nothing inside this `<Fragment>` is derived on the server, so its `<Fallback>` can never appear."], visitor.diagnostics.map(&:message)
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

        assert_equal ["Nothing inside this `<Fragment>` is derived on the server, so its `<Fallback>` can never appear."], visitor.diagnostics.map(&:message)
      end

      test "a fallback outside a fragment errors" do
        visitor, = compile(%(<%# herb:slots client %>\n<Fallback><p>alone</p></Fallback>))

        assert_equal ["herb-slots-component"], visitor.diagnostics.map(&:code)
        assert_equal ["`<Fallback>` sits outside a `<Fragment>`, so there is nothing for it to stand in for."], visitor.diagnostics.map(&:message)
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

        assert_equal(
          [
            "A `<Fragment>` holds 2 `<Fallback>` elements, and it can only stand one in.",
            "Nothing inside this `<Fragment>` is derived on the server, so its `<Fallback>` can never appear."
          ],
          visitor.diagnostics.map(&:message)
        )
      end

      test "an unknown component errors and lists the built-ins" do
        visitor, = compile(%(<%# herb:slots client %>\n<Skeleton><p>x</p></Skeleton>))

        diagnostic = visitor.diagnostics.fetch(0)

        assert_equal "herb-slots-component", diagnostic.code
        assert_equal "`<Skeleton>` is not a component Herb knows.", diagnostic.message
        assert_equal "The built-in components are `<Fragment>` and `<Fallback>`.", diagnostic.suggestion
      end

      test "an unknown attribute on a fragment errors" do
        visitor, = compile(%(<%# herb:slots client %>\n<Fragment id="x"><p><%= @a %></p><Fallback>f</Fallback></Fragment>))

        assert_equal(
          [
            "`<Fragment>` only takes `delay` and `hold` and `on`.",
            "Nothing inside this `<Fragment>` is derived on the server, so its `<Fallback>` can never appear."
          ],
          visitor.diagnostics.map(&:message)
        )
      end

      test "attributes on a fallback error" do
        visitor, = compile(%(<%# herb:slots client %>\n<Fragment><p><%= @a %></p><Fallback delay="150">f</Fallback></Fragment>))

        assert_equal(
          [
            "`<Fallback>` takes no attributes yet.",
            "Nothing inside this `<Fragment>` is derived on the server, so its `<Fallback>` can never appear."
          ],
          visitor.diagnostics.map(&:message)
        )
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

        assert_equal ["`on` names the states that mask this `<Fragment>`, and it names none."], visitor.diagnostics.map(&:message)
      end
    end
  end
end
