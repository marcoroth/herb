# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class SlotVisitorTest < Minitest::Spec
    def slots_for(template, file_path: "app/views/test.html.erb")
      Herb::Engine.new(template, slots: true, filename: file_path, validation_mode: :none).slot_visitor
    end

    test "assigns an index to ERB output in child position" do
      visitor = slots_for("<p><%= @name %></p>")

      assert_equal 1, visitor.slots.size
      assert_equal 0, visitor.slots[0].index
      assert_equal :child, visitor.slots[0].type
      assert_equal "@name", visitor.slots[0].expression
    end

    test "assigns indices in document order" do
      visitor = slots_for("<p><%= @a %></p><p><%= @b %></p><p><%= @c %></p>")

      assert_equal [0, 1, 2], visitor.slots.map(&:index)
      assert_equal ["@a", "@b", "@c"], visitor.slots.map(&:expression)
    end

    test "records the node_path that TemplateDependencies reports" do
      visitor = slots_for("<div><h1><%= @title %></h1></div>")

      assert_equal [0, 0, 0], visitor.slots[0].node_path
    end

    test "records source location" do
      visitor = slots_for("<p>\n  <%= @name %>\n</p>")

      assert_equal "2:2", visitor.slots[0].location
    end

    test "classifies conditionals" do
      visitor = slots_for("<div><% if @admin %><b>x</b><% end %></div>")

      assert_equal :conditional, visitor.slots[0].type
    end

    test "classifies ERB inside an attribute value" do
      visitor = slots_for(%(<div class="<%= @klass %>"></div>))

      assert_equal :attribute, visitor.slots[0].type
    end

    test "classifies an each block as a collection" do
      visitor = slots_for("<ul><% @items.each do |item| %><li>x</li><% end %></ul>")

      assert_equal :collection, visitor.slots[0].type
    end

    test "classifies other iteration methods as collections" do
      [
        "<div><% 3.times do |i| %><b>x</b><% end %></div>",
        "<div><% @a.map do |i| %><b>x</b><% end %></div>"
      ].each do |template|
        assert_equal :collection, slots_for(template).slots[0].type, "unexpected type for: #{template}"
      end
    end

    test "treats an if/elsif/else chain as a single conditional slot" do
      visitor = slots_for("<div><% if @a %>A<% elsif @b %>B<% else %>C<% end %></div>")

      assert_equal [:conditional], visitor.slots.map(&:type)
    end

    test "gives a conditional nested inside an else its own slot" do
      visitor = slots_for("<div><% if @a %>A<% else %><% if @b %>B<% end %><% end %></div>")

      assert_equal [:conditional, :conditional], visitor.slots.map(&:type)
    end

    test "assigns a slot inside a when branch" do
      visitor = slots_for("<div><% case @x %><% when 1 %><%= @a %><% end %></div>")

      assert_equal [:conditional, :child], visitor.slots.map(&:type)
    end

    test "classifies a builder block as a plain block" do
      visitor = slots_for("<div><%= form_with model: @user do |f| %><input><% end %></div>")

      assert_equal :block, visitor.slots[0].type
    end

    test "classifies a non-iteration method block as a plain block" do
      visitor = slots_for("<div><% @user.tap do |u| %><b>x</b><% end %></div>")

      assert_equal :block, visitor.slots[0].type
    end

    test "classifies a dynamic HTML comment" do
      visitor = slots_for("<!-- Content: <%= @c %> -->")

      assert_equal [:comment], visitor.slots.map(&:type)
    end

    test "does not assign a slot to a static HTML comment" do
      visitor = slots_for("<!-- just a note -->")

      assert_empty visitor.slots
    end

    test "assigns one slot to a comment regardless of how much ERB it holds" do
      visitor = slots_for("<!-- <%= @a %> and <%= @b %> -->")

      assert_equal [:comment], visitor.slots.map(&:type)
    end

    test "does not assign a slot to non-output ERB" do
      visitor = slots_for("<% x = 1 %><p>static</p>")

      assert_empty visitor.slots
    end

    test "assigns nested slots inside a conditional" do
      visitor = slots_for("<div><% if @admin %><b><%= @secret %></b><% end %></div>")

      assert_equal [:conditional, :child], visitor.slots.map(&:type)
      assert_equal [0, 0], visitor.slots[0].node_path
      assert_equal [0, 0, 0, 0], visitor.slots[1].node_path
    end

    test "schema exposes slot count, types and paths" do
      visitor = slots_for("<p><%= @a %></p><div><% if @b %><i>x</i><% end %></div>")
      schema = visitor.schema

      assert_equal "app/views/test.html.erb", schema[:file]
      assert_equal 2, schema[:slots].size
      assert_equal([:child, :conditional], schema[:slots].map { |slot| slot[:type] })
    end

    test "schema version is stable for the same slot layout" do
      assert_equal slots_for("<p><%= @a %></p>").version, slots_for("<p><%= @b %></p>").version
    end

    test "schema version changes when a slot is added" do
      refute_equal slots_for("<p><%= @a %></p>").version,
                   slots_for("<p><%= @a %></p><p><%= @b %></p>").version
    end

    test "schema version changes when a slot type changes" do
      refute_equal slots_for("<div><%= @a %></div>").version,
                   slots_for("<div><% if @a %>x<% end %></div>").version
    end

    test "engine exposes no slot visitor unless slots are enabled" do
      assert_nil Herb::Engine.new("<p><%= @a %></p>", validation_mode: :none).slot_visitor
    end
  end
end
