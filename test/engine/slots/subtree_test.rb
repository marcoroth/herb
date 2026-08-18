# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slot_subtree"

module Engine
  module Slots
    class SubtreeTest < Minitest::Spec
      class View
        def initialize(**assigns)
          assigns.each { |name, value| instance_variable_set(:"@#{name}", value) }
        end
      end

      CONDITIONAL = "<div><% if @admin %><b>yes</b><% else %><i>no</i><% end %></div>"
      COLLECTION = "<ul><% @items.each do |item| %><li><%= item %></li><% end %></ul>"

      def subtree(source)
        Herb::Engine::SlotSubtree.new(source, filename: "app/views/posts/index.html.erb")
      end

      def render(source, index, **assigns)
        View.new(**assigns).instance_eval(subtree(source).source_for(index))
      end

      test "renders the branch the page is showing" do
        assert_equal "<i>no</i>", render(CONDITIONAL, 0, admin: false)
      end

      test "renders a branch the page never had" do
        assert_equal "<b>yes</b>", render(CONDITIONAL, 0, admin: true)
      end

      test "renders every item a collection has" do
        assert_equal "<li>a</li><li>b</li>", render(COLLECTION, 0, items: ["a", "b"])
      end

      test "renders the first item a collection has ever had" do
        assert_equal "<li>only</li>", render(COLLECTION, 0, items: ["only"])
      end

      test "renders nothing for a collection that lost every item" do
        assert_equal "", render(COLLECTION, 0, items: [])
      end

      test "refuses an attribute, which the path cannot name on its own" do
        source = %(<div class="<%= @klass %>">x</div>)

        refute subtree(source).addressable?(0)
        assert_nil subtree(source).source_for(0)
      end

      test "refuses a slot the template does not have" do
        assert_nil subtree(CONDITIONAL).source_for(99)
        refute subtree(CONDITIONAL).addressable?(99)
      end

      test "names each slot by the path the visitor recorded" do
        visitor = Herb::Engine::SlotVisitor.new

        Herb::Engine.new(COLLECTION, visitors: [visitor], filename: "app/views/posts/index.html.erb")

        subject = subtree(COLLECTION)

        visitor.slots.each do |slot|
          assert_equal slot.node_path, subject.node_path_for(slot.index)
        end
      end

      test "carries the version the markers were written with" do
        visitor = Herb::Engine::SlotVisitor.new

        Herb::Engine.new(COLLECTION, visitors: [visitor], filename: "app/views/posts/index.html.erb")

        assert_equal visitor.schema[:version], subtree(COLLECTION).version
      end
    end
  end
end
