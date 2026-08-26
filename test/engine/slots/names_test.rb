# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    class NamesTest < Minitest::Spec
      include SnapshotUtils

      def options
        { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client)], filename: "app/views/test.html.erb" }
      end

      def compile(template)
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client)
        engine = Herb::Engine.new(template, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor, engine.src]
      end

      def slots(template)
        compile(template).first.slots
      end

      test "records a name against the slot the element holds" do
        named = slots(%(<p data-herb-name="body"><%= @body %></p>)).find { |slot| slot.name == "body" }

        assert named
        assert_equal :child, named.type
      end

      test "leaves the name the template wrote where the template wrote it" do
        assert_evaluated_snapshot(%(<p data-herb-name="body"><%= @body %></p>), { "@body" => "hi" }, options)
      end

      test "says which slot that name is, in the manifest" do
        visitor, = compile(%(<p data-herb-name="body"><%= @body %></p>))
        index = visitor.slots.find { |slot| slot.name == "body" }.index

        assert_equal({ "body" => index }, visitor.manifest["names"])
      end

      test "mixed static text around one slot still resolves" do
        named = slots(%(<p data-herb-name="greeting">Hello <%= @name %>!</p>)).find { |slot| slot.name == "greeting" }

        assert named
        assert_equal :child, named.type
      end

      test "names the collection an element holds" do
        template = %(<ul data-herb-name="messages"><% @messages.each do |m| %><li id="<%= m %>"><%= m %></li><% end %></ul>)
        named = slots(template).find { |slot| slot.name == "messages" }

        assert named
        assert_equal :collection, named.type
      end

      test "an element with two content slots is ambiguous" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="pair"><%= @first %> and <%= @second %></p>))
        end

        assert_equal "`data-herb-name=\"pair\"` on `<p>` is ambiguous between 2 slots. Wrap the one it should name in its own element.", error.message
      end

      test "an element holding nothing dynamic names no slot" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="static">plain text</p>))
        end

        assert_equal "`data-herb-name=\"static\"` on `<p>` names no slot, since the element holds nothing dynamic. Move the name onto an element that wraps an ERB output, or remove it.", error.message
      end

      test "a computed name is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="<%= @name %>"><%= @body %></p>))
        end

        assert_equal "`data-herb-name` on `<p>` is computed or empty. A slot name is an address the browser looks up, so give it a static, non-empty value.", error.message
      end

      test "two slots in one scope cannot share a name" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="body"><%= @a %></p><div data-herb-name="body"><%= @b %></div>))
        end

        assert_equal "Two slots in the same scope are both named `body`. A slot name is an address, so give one of them a different name.", error.message
      end

      test "a name may repeat between an item and its region" do
        template = <<~ERB
          <p data-herb-name="body"><%= @intro %></p>
          <ul><% @items.each do |item| %><li id="<%= item %>"><span data-herb-name="body"><%= item %></span></li><% end %></ul>
        ERB

        named = slots(template).select { |slot| slot.name == "body" }

        assert_equal 2, named.size
      end

      test "a name colliding with an attribute slot in the same scope is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<div id="<%= @id %>"><p data-herb-name="id"><%= @body %></p></div>))
        end

        assert_equal "The name `id` collides with the `id` attribute slot in the same scope. An attribute slot is already addressable by its attribute, so drop the name or rename it.", error.message
      end

      test "a collapsed conditional does not shift the collision check" do
        template = <<~ERB
          <% if @a %><b><%= @p %></b><% else %><b><%= @q %></b><% end %>
          <% for item in @items %>
            <input sel="<%= item.id %>">
          <% end %>
          <div data-herb-name="sel"><%= @y %></div>
        ERB

        named = slots(template).find { |slot| slot.name == "sel" }

        assert named
        assert_equal :child, named.type
      end

      test "two named elements cannot claim one slot" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<div data-herb-name="outer"><span data-herb-name="inner"><%= @x %></span></div>))
        end

        assert_equal "`data-herb-name=\"outer\"` claims the slot already named `inner`. Both elements hold the same slot, so keep one name or wrap what each should address in its own element.", error.message
      end

      test "a nested container's slots do not confuse the count" do
        template = %(<div data-herb-name="status"><% if @ok %><b><%= @yes %></b><% else %><%= @no %><% end %></div>)
        named = slots(template).find { |slot| slot.name == "status" }

        assert named
        assert_equal :conditional, named.type
      end

      test "the name is part of the version" do
        plain = compile(%(<p><%= @body %></p>)).first.version
        named = compile(%(<p data-herb-name="body"><%= @body %></p>)).first.version

        refute_equal plain, named
      end
    end
  end
end
