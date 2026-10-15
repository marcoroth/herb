# frozen_string_literal: true

require_relative "../action_view/action_view_test_helper"
require_relative "../../../lib/herb/engine/slots/dynamics_compiler"

module Engine
  module Slots
    class LoweredHelperTextTest < Minitest::Spec
      include Engine::ActionViewTestHelper

      test "lowered link text has the same child slot as explicit ERB" do
        source = '<%= link_to label, "/profile", class: "link" %>'
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(source)
        child = compiler.slot_visitor.slots.find { |slot| slot.type == :child }

        refute_nil child
        assert_equal "Alice", action_view_eval(compiler.src, { label: "Alice" }).fetch(:slots).fetch(child.index)

        rendered = Herb::Engine.new(source, visitors: [Herb::Engine::Slots::Visitor.new])
        assert_snapshot_matches(action_view_eval(rendered.src, { label: "Alice" }), "lowered-link-text")
      end

      test "keyed rows carry dynamic link text in their values and statics" do
        source = <<~ERB
          <%# herb:slots server %>
          <ul><% people.each do |person| %><%# herb:key person[:id] %><li><%= link_to person[:name], person[:path], class: "link" %></li><% end %></ul>
        ERB
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(source)
        child = compiler.slot_visitor.slots.find { |slot| slot.type == :child }

        refute_nil child
        collection = compiler.slot_visitor.slots.find { |slot| slot.type == :collection }
        refute_nil collection

        payload = action_view_eval(compiler.src, { people: [{ id: 2, name: "New person", path: "/people/2" }] })
        rows = payload.fetch(:slots).fetch(collection.index)

        assert_equal "New person", rows.fetch(:items).fetch("2").fetch(child.index)
        assert_snapshot_matches(rows.fetch(:statics), "lowered-link-item-statics")
      end

      test "lowered attribute expressions do not get extra child slots" do
        compiler = Herb::Engine::Slots::DynamicsCompiler.new('<%= link_to "Static", path, title: title %>')

        assert_empty(compiler.slot_visitor.slots.select { |slot| slot.type == :child })
        assert_equal ["href", "title"], compiler.slot_visitor.slots.select { |slot| slot.type == :attribute }.map(&:attribute).sort
      end

      test "state-dependent lowered link text is carried as a child value" do
        source = '<%# herb:state (label: "Alice") %><%= link_to label, "/profile" %>'
        compiler = Herb::Engine::Slots::DynamicsCompiler.new(source)
        child = compiler.slot_visitor.slots.find { |slot| slot.type == :child }

        refute_nil child
        assert_equal "Alice", action_view_eval(compiler.src).fetch(:slots).fetch(child.index)
      end
    end
  end
end
