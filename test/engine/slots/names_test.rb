# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    class NamesTest < Minitest::Spec
      include SnapshotUtils

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

      test "rewrites the attribute to carry the slot index" do
        visitor, src = compile(%(<p data-herb-name="body"><%= @body %></p>))
        rendered = evaluate_herb_source(src, { "@body" => "hi" })
        index = visitor.slots.find { |slot| slot.name == "body" }.index

        assert_includes rendered, %(data-herb-name="#{index}:body")
        refute_includes rendered, %(data-herb-name="body")
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

        assert_match(/ambiguous/, error.message)
        assert_match(/wrap/, error.message)
      end

      test "an element holding nothing dynamic names no slot" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="static">plain text</p>))
        end

        assert_match(/names no slot/, error.message)
      end

      test "a computed name is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="<%= @name %>"><%= @body %></p>))
        end

        assert_match(/static/, error.message)
      end

      test "two slots in one scope cannot share a name" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<p data-herb-name="body"><%= @a %></p><div data-herb-name="body"><%= @b %></div>))
        end

        assert_match(/unique/, error.message)
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

        assert_match(/collides/, error.message)
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

        assert_match(/claims the slot already named/, error.message)
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
