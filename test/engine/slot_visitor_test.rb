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

    test "detects an explicit herb-key on a collection" do
      visitor = slots_for(%(<% @u.each do |u| %><li herb-key="<%= u.id %>">x</li><% end %>))

      assert_equal :herb_key, visitor.slots.find { |slot| slot.type == :collection }.key_source
    end

    test "falls back to an id, which Rails templates already carry for Turbo" do
      visitor = slots_for(%(<% @u.each do |u| %><li id="<%= dom_id(u) %>">x</li><% end %>))

      assert_equal :id, visitor.slots.find { |slot| slot.type == :collection }.key_source
    end

    test "prefers herb-key over an id" do
      visitor = slots_for(%(<% @u.each do |u| %><li id="a" herb-key="<%= u.id %>">x</li><% end %>))

      assert_equal :herb_key, visitor.slots.find { |slot| slot.type == :collection }.key_source
    end

    test "falls back to index when a collection row carries no key" do
      visitor = slots_for("<% @u.each do |u| %><li>x</li><% end %>")

      assert_equal :index, visitor.slots.find { |slot| slot.type == :collection }.key_source
    end

    test "warns about an unkeyed collection and names the row to key" do
      visitor = slots_for("<% @u.each do |u| %><li>x</li><% end %>")

      assert_equal 1, visitor.warnings.size
      assert_equal "unkeyed_collection", visitor.warnings[0].type
      assert_equal "li", visitor.warnings[0].tag_name
      assert_includes visitor.warnings[0].message, "Add a `herb-key` or `id` attribute to `<li>`"
    end

    test "warns about an unkeyed collection with several roots by suggesting a wrapper" do
      visitor = slots_for("<% @u.each do |u| %><li>a</li><li>b</li><% end %>")

      assert_equal 1, visitor.warnings.size
      assert_nil visitor.warnings[0].tag_name
      assert_includes visitor.warnings[0].message, "wrap each row in a single element"
    end

    test "does not warn when a collection carries a key" do
      assert_empty slots_for("<% @u.each do |u| %><li id='<%= u.id %>'>x</li><% end %>").warnings
      assert_empty slots_for("<% @u.each do |u| %><%# herb:key u.id %><li>a</li><li>b</li><% end %>").warnings
    end

    test "detects a herb:key directive on a body with several roots" do
      visitor = slots_for("<% @u.each do |u| %><%# herb:key u.id %><li>a</li><li>b</li><% end %>")
      slot = visitor.slots.find { |candidate| candidate.type == :collection }

      assert_equal :directive, slot.key_source
      assert_equal "u.id", slot.key_expression
    end

    test "detects a herb:key directive on a body with no element at all" do
      visitor = slots_for("<% @u.each do |u| %><%# herb:key u.id %><%= u.name %><% end %>")

      assert_equal :directive, visitor.slots.find { |slot| slot.type == :collection }.key_source
    end

    test "prefers a herb:key directive over an attribute" do
      visitor = slots_for(%(<% @u.each do |u| %><%# herb:key u.uuid %><li id="<%= u.id %>">x</li><% end %>))
      slot = visitor.slots.find { |candidate| candidate.type == :collection }

      assert_equal :directive, slot.key_source
      assert_equal "u.uuid", slot.key_expression
    end

    test "records the key expression from the attribute it was found on" do
      visitor = slots_for(%(<% @u.each do |u| %><li id="<%= dom_id(u) %>">x</li><% end %>))

      assert_equal "dom_id(u)", visitor.slots.find { |slot| slot.type == :collection }.key_expression
    end

    test "falls back to index when a collection body has no single root" do
      visitor = slots_for("<% @u.each do |u| %><li>a</li><li>b</li><% end %>")

      assert_equal :index, visitor.slots.find { |slot| slot.type == :collection }.key_source
    end

    test "exposes the key source in the schema" do
      schema = slots_for(%(<% @u.each do |u| %><li herb-key="<%= u.id %>">x</li><% end %>)).schema

      assert_equal :herb_key, schema[:slots].find { |slot| slot[:type] == :collection }[:key_source]
    end

    test "records no key source for slots that are not collections" do
      visitor = slots_for("<p><%= @a %></p>")

      assert_nil visitor.slots[0].key_source
    end

    test "records the attribute a slot belongs to" do
      visitor = slots_for(%(<div class="<%= @c %>" id="<%= @i %>"></div>))

      assert_equal ["class", "id"], visitor.slots.map(&:attribute)
    end

    test "distinguishes a whole attribute value from an interpolated one" do
      assert_equal :attribute, slots_for(%(<div class="<%= @c %>"></div>)).slots[0].type
      assert_equal :attribute_interpolation, slots_for(%(<div class="a <%= @c %> b"></div>)).slots[0].type
    end

    test "gives an attribute one slot however many bindings it holds" do
      visitor = slots_for(%(<div class="a <%= @x %> b <%= @y %>"></div>))

      assert_equal 1, visitor.slots.size
      assert_equal "class", visitor.slots[0].attribute
    end

    test "exposes the attribute name in the schema" do
      schema = slots_for(%(<div class="<%= @c %>"></div>)).schema

      assert_equal "class", schema[:slots][0][:attribute]
    end

    test "does not assign a slot to a static attribute" do
      visitor = slots_for(%(<div class="static"><%= @a %></div>))

      assert_equal [:child], visitor.slots.map(&:type)
    end

    test "anchors ERB in element position on the element" do
      visitor = slots_for("<div <%= @attributes %>>x</div>")

      assert_equal [:element], visitor.slots.map(&:type)
    end

    test "anchors RCDATA content on the element" do
      ["<textarea><%= @a %></textarea>", "<title><%= @a %></title>"].each do |template|
        visitor = slots_for(template)

        assert_equal [:raw_text], visitor.slots.map(&:type), "unexpected type for: #{template}"
      end
    end

    test "does not assign a slot inside raw text elements" do
      ["<script>var a = \"<%= @a %>\";</script>", "<style>.a { color: <%= @a %>; }</style>"].each do |template|
        visitor = slots_for(template)

        assert_empty visitor.slots, "expected no slot for: #{template}"
      end
    end

    test "classifies while, until and for as repeating regions" do
      {
        "<% while @i %><b>x</b><% end %>" => :collection,
        "<% until @i %><b>x</b><% end %>" => :collection,
        "<% for x in @l %><b>x</b><% end %>" => :collection,
      }.each do |template, expected|
        visitor = slots_for(template)

        assert_equal expected, visitor.slots.first&.type, "unexpected type for: #{template}"
      end
    end

    test "assigns no slots when the template has parser errors" do
      ["<div><p><%= @a %></div>", "</div><p><%= @a %></p>"].each do |template|
        engine = Herb::Engine.new(template, slots: true, filename: "t.html.erb", validation_mode: :none)

        assert_empty engine.slot_visitor.slots, "expected no slots for: #{template}"
        refute_includes engine.src, "herb-slot"
        refute_includes engine.src, "herb-region"
      end
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
