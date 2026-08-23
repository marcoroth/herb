# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slot_visitor"
require_relative "../../../lib/herb/analysis/template_dependencies"

require "tmpdir"
require "fileutils"

module Engine
  module Slots
    class VisitorTest < Minitest::Spec
      include SnapshotUtils

      def slots_for(template, file_path: "app/views/test.html.erb")
        visitor = Herb::Engine::SlotVisitor.new

        Herb::Engine.new(template, visitors: [visitor], filename: file_path)

        visitor
      end

      def assert_slots_snapshot(template, file_path: "app/views/test.html.erb")
        visitor = slots_for(template, file_path: file_path)

        assert_snapshot_matches(format_slots(visitor), template, { filename: file_path })

        visitor
      end

      def node_paths_for(template, state)
        Dir.mktmpdir do |root|
          file_path = File.join(root, "app", "views", "test.html.erb")

          FileUtils.mkdir_p(File.dirname(file_path))
          File.write(file_path, template)

          visitor = slots_for(template, file_path: file_path)
          dependencies = Herb::Analysis::TemplateDependencies.new(root)

          [
            dependencies.affected_nodes(file_path, state).map { |node| node[:node_path] },
            visitor.slots.map(&:node_path)
          ]
        end
      end

      def types_for(template)
        slots_for(template).slots.map { |slot| [slot.index, slot.type] }
      end

      def format_slots(visitor)
        schema = visitor.schema
        lines = ["file: #{schema[:file]}", "version: #{schema[:version]}", ""]

        if visitor.slots.empty?
          lines << "slots: (none)"
        else
          lines << "slots:"

          visitor.slots.each do |slot|
            fields = ["index=#{slot.index}", "type=#{slot.type}", "node_path=#{slot.node_path.inspect}"]

            fields << "expression=#{slot.expression.inspect}" unless slot.expression.nil?
            fields << "location=#{slot.location}" unless slot.location.nil?
            fields << "attribute=#{slot.attribute.inspect}" unless slot.attribute.nil?
            fields << "key_source=#{slot.key_source}" unless slot.key_source.nil?
            fields << "key_expression=#{slot.key_expression.inspect}" unless slot.key_expression.nil?

            lines << "  #{fields.join("  ")}"
          end
        end

        unless visitor.warnings.empty?
          lines << ""
          lines << "warnings:"

          visitor.warnings.each do |warning|
            fields = ["type=#{warning.type}"]

            fields << "tag_name=#{warning.tag_name.inspect}" if warning.respond_to?(:tag_name)
            fields << "message=#{warning.message.inspect}"

            lines << "  #{fields.join("  ")}"
          end
        end

        "#{lines.join("\n")}\n"
      end

      test "assigns an index to ERB output in child position" do
        assert_slots_snapshot("<p><%= @name %></p>")
      end

      test "assigns indices in document order" do
        assert_slots_snapshot("<p><%= @a %></p><p><%= @b %></p><p><%= @c %></p>")
      end

      test "records a node_path for every node TemplateDependencies reports" do
        {
          "<div><h1><%= @title %></h1></div>" => "@title",
          "<div><% if @admin %><%= @name %><% end %></div>" => "@admin",
          "<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>" => "@items",
          %(<div class="<%= @klass %>"></div>) => "@klass",
          %(<div><a href="<%= @url %>">x</a></div>) => "@url",
        }.each do |template, state|
          reported, recorded = node_paths_for(template, state)

          refute_empty reported, template

          reported.each do |node_path|
            assert_includes recorded, node_path, template
          end
        end
      end

      test "records source location" do
        assert_slots_snapshot("<p>\n  <%= @name %>\n</p>")
      end

      test "classifies conditionals" do
        assert_slots_snapshot("<div><% if @admin %><b>x</b><% end %></div>")
      end

      test "classifies ERB inside an attribute value" do
        assert_slots_snapshot(%(<div class="<%= @klass %>"></div>))
      end

      test "classifies an each block as a collection" do
        assert_slots_snapshot("<ul><% @items.each do |item| %><li>x</li><% end %></ul>")
      end

      test "classifies other iteration methods as collections" do
        assert_slots_snapshot("<div><% 3.times do |i| %><b>x</b><% end %></div>")
        assert_slots_snapshot("<div><% @a.map do |i| %><b>x</b><% end %></div>")
      end

      test "treats an if/elsif/else chain as a single conditional slot" do
        assert_slots_snapshot("<div><% if @a %>A<% elsif @b %>B<% else %>C<% end %></div>")
      end

      test "gives a conditional nested inside an else its own slot" do
        assert_slots_snapshot("<div><% if @a %>A<% else %><% if @b %>B<% end %><% end %></div>")
      end

      test "assigns a slot inside a when branch" do
        assert_slots_snapshot("<div><% case @x %><% when 1 %><%= @a %><% end %></div>")
      end

      test "classifies a builder block as a plain block" do
        assert_slots_snapshot("<div><%= form_with model: @user do |f| %><input><% end %></div>")
      end

      test "does not record a block whose value is not output" do
        assert_slots_snapshot("<div><% @user.tap do |u| %><b>x</b><% end %></div>")
      end

      test "classifies a dynamic HTML comment" do
        assert_slots_snapshot("<!-- Content: <%= @c %> -->")
      end

      test "does not assign a slot to a static HTML comment" do
        assert_slots_snapshot("<!-- just a note -->")
      end

      test "assigns one slot to a comment regardless of how much ERB it holds" do
        assert_slots_snapshot("<!-- <%= @a %> and <%= @b %> -->")
      end

      test "detects an explicit herb-key on a collection" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li herb-key="<%= u.id %>">x</li><% end %>))
      end

      test "falls back to an id, which Rails templates already carry for Turbo, and records its expression" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li id="<%= dom_id(u) %>">x</li><% end %>))
      end

      test "prefers herb-key over an id" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li id="a" herb-key="<%= u.id %>">x</li><% end %>))
      end

      test "falls back to index and names the item to key when a collection item carries no key" do
        assert_slots_snapshot("<% @u.each do |u| %><li>x</li><% end %>")
      end

      test "falls back to index and suggests a wrapper when a collection body has several roots" do
        assert_slots_snapshot("<% @u.each do |u| %><li>a</li><li>b</li><% end %>")
      end

      test "does not warn when a collection carries a key" do
        assert_slots_snapshot("<% @u.each do |u| %><li id='<%= u.id %>'>x</li><% end %>")
      end

      test "detects a herb:key directive on a body with several roots" do
        assert_slots_snapshot("<% @u.each do |u| %><%# herb:key u.id %><li>a</li><li>b</li><% end %>")
      end

      test "detects a herb:key directive on a body with no element at all" do
        assert_slots_snapshot("<% @u.each do |u| %><%# herb:key u.id %><%= u.name %><% end %>")
      end

      test "prefers a herb:key directive over an attribute" do
        assert_slots_snapshot(%(<% @u.each do |u| %><%# herb:key u.uuid %><li id="<%= u.id %>">x</li><% end %>))
      end

      test "records no key source for slots that are not collections" do
        assert_slots_snapshot("<p><%= @a %></p>")
      end

      test "records the attribute a slot belongs to" do
        assert_slots_snapshot(%(<div class="<%= @c %>" id="<%= @i %>"></div>))
      end

      test "distinguishes an interpolated attribute value from a whole one" do
        assert_slots_snapshot(%(<div class="a <%= @c %> b"></div>))
      end

      test "anchors an attributes splat to the element instead of an attribute" do
        assert_slots_snapshot(%(<div <%= @attrs %>></div>))
      end

      test "anchors a dynamically named attribute to the element" do
        assert_slots_snapshot(%(<div <%= @key %>="1"></div>))
      end

      test "gives an attribute one slot however many bindings it holds" do
        assert_slots_snapshot(%(<div class="a <%= @x %> b <%= @y %>"></div>))
      end

      test "does not assign a slot to a static attribute" do
        assert_slots_snapshot(%(<div class="static"><%= @a %></div>))
      end

      test "anchors ERB in element position on the element" do
        assert_slots_snapshot("<div <%= @attributes %>>x</div>")
      end

      test "anchors RCDATA content on the element" do
        assert_slots_snapshot("<textarea><%= @a %></textarea>")
        assert_slots_snapshot("<title><%= @a %></title>")
      end

      test "does not assign a slot inside raw text elements" do
        assert_slots_snapshot("<script>var a = \"<%= @a %>\";</script>")
        assert_slots_snapshot("<style>.a { color: <%= @a %>; }</style>")
      end

      test "classifies while, until and for as repeating regions" do
        assert_slots_snapshot("<% while @i %><b>x</b><% end %>")
        assert_slots_snapshot("<% until @i %><b>x</b><% end %>")
        assert_slots_snapshot("<% for x in @l %><b>x</b><% end %>")
      end

      test "does not assign a slot to non-output ERB" do
        assert_slots_snapshot("<% x = 1 %><p>static</p>")
      end

      test "assigns nested slots inside a conditional" do
        assert_slots_snapshot("<div><% if @admin %><b><%= @secret %></b><% end %></div>")
      end

      test "schema exposes slot count, types and paths" do
        assert_slots_snapshot("<p><%= @a %></p><div><% if @b %><i>x</i><% end %></div>")
      end

      test "reads a key from an attribute that surrounds its expression with text" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li id="user-<%= u.id %>">x</li><% end %>))
      end

      test "reads a key from an attribute holding several expressions" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li id="<%= u.type %>-<%= u.id %>">x</li><% end %>))
      end

      test "reads an interpolated herb-key" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li herb-key="item-<%= u.id %>">x</li><% end %>))
      end

      test "keeps a literal key part from being read as Ruby" do
        assert_slots_snapshot('<% @u.each do |u| %><li id="a\b#{c}-<%= u.id %>">x</li><% end %>')
      end

      test "falls back to index when a key attribute holds no expression" do
        assert_slots_snapshot(%(<% @u.each do |u| %><li id="static">x</li><% end %>))
      end

      test "keeps the attribute name a string so the schema stays serializable" do
        visitor = slots_for(%(<div class="<%= @c %>" <%= @attrs %>></div>))

        assert_equal([String, NilClass], visitor.slots.map { |slot| slot.attribute.class })

        parsed = JSON.parse(JSON.generate(visitor.schema))
        attributes = parsed["slots"].filter_map { |slot| slot["attribute"] }

        assert_equal ["class"], attributes
      end

      test "schema version is stable for the same slot layout" do
        assert_equal(
          slots_for("<p><%= @a %></p>").version,
          slots_for("<p><%= @b %></p>").version
        )
      end

      test "schema version changes when a slot is added" do
        refute_equal(
          slots_for("<p><%= @a %></p>").version,
          slots_for("<p><%= @a %></p><p><%= @b %></p>").version
        )
      end

      test "schema version changes when a slot type changes" do
        refute_equal(
          slots_for("<div><%= @a %></div>").version,
          slots_for("<div><% if @a %>x<% end %></div>").version
        )
      end

      test "schema version changes when the attribute a slot writes to changes" do
        refute_equal(
          slots_for(%(<a href="<%= @url %>">link</a>)).version,
          slots_for(%(<a title="<%= @url %>">link</a>)).version
        )
      end

      test "schema version changes when a slot moves in the tree" do
        refute_equal(
          slots_for("<div><%= @a %></div>").version,
          slots_for("<div><span><%= @a %></span></div>").version
        )
      end

      test "schema version changes when a collection key source changes" do
        refute_equal(
          slots_for(%(<% @u.each do |u| %><li herb-key="<%= u.id %>">x</li><% end %>)).version,
          slots_for(%(<% @u.each do |u| %><li id="<%= u.id %>">x</li><% end %>)).version
        )
      end

      test "assigns no slots when the template has parser errors" do
        ["<div><p><%= @a %></div>", "</div><p><%= @a %></p>"].each do |template|
          visitor = Herb::Engine::SlotVisitor.new

          assert_raises(Herb::Engine::ParseError, "expected a parse error for: #{template}") do
            Herb::Engine.new(template, visitors: [visitor], filename: "t.html.erb")
          end

          assert_empty visitor.slots, "expected no slots for: #{template}"
        end
      end

      test "a herb:slots directive opts a single template in" do
        assert Herb::Engine::SlotVisitor.directive?("<%# herb:slots %>\n<p><%= @a %></p>")
      end

      test "recognises the trimming and unspaced forms of the directive" do
        ["<%#- herb:slots -%>", "<%#herb:slots%>", "<%#   herb:slots   %>"].each do |directive|
          assert Herb::Engine::SlotVisitor.directive?("#{directive}<p><%= @a %></p>"), "expected slots for: #{directive}"
        end
      end

      test "a template says who renders its branches" do
        assert_equal :client, Herb::Engine::SlotVisitor.directive_mode("<%# herb:slots client %>\n<p><%= @a %></p>")
        assert_equal :server, Herb::Engine::SlotVisitor.directive_mode("<%# herb:slots server %>\n<p><%= @a %></p>")
      end

      test "asking for slots and nothing else means the server renders the branches" do
        assert_equal :server, Herb::Engine::SlotVisitor.directive_mode("<%# herb:slots %>\n<p><%= @a %></p>")
        assert_equal :server, Herb::Engine::SlotVisitor.directive_mode("<%#- herb:slots -%><p><%= @a %></p>")
      end

      test "no directive is not a mode at all" do
        assert_nil Herb::Engine::SlotVisitor.directive_mode("<p><%= @a %></p>")
      end

      test "refuses a mode it does not know" do
        error = assert_raises(ArgumentError) { Herb::Engine::SlotVisitor.new(mode: :nonsense) }

        assert_match(/unknown slot mode/, error.message)
      end

      test "leaves other ERB comments alone" do
        ["<%# just a note %>", "<%# herb:key u.id %>", "<%# slots %>"].each do |comment|
          refute Herb::Engine::SlotVisitor.directive?("#{comment}<p><%= @a %></p>"), "expected no slots for: #{comment}"
        end
      end

      test "the engine emits no markers unless the visitor is in the stack" do
        engine = Herb::Engine.new("<%# herb:slots %><p><%= @a %></p>")

        refute_includes engine.src, "herb-slot"
        refute_includes engine.src, "herb-region"
      end

      test "a slot written on an element names the attribute it stands for" do
        visitor = slots_for(%(<li class="<%= @c %>" data-x="<%= @d %>"><%= @n %></li>))

        assert_equal ["class", "data-x", nil], visitor.slots.map(&:attribute)
      end

      test "names a template by its path unless asked otherwise" do
        assert_equal "app/views/test.html.erb", slots_for("<p><%= @a %></p>").identifier
      end

      test "names a template by a digest of its path when asked" do
        visitor = Herb::Engine::SlotVisitor.new(identifier: :digest)

        Herb::Engine.new("<p><%= @a %></p>", visitors: [visitor], filename: "app/views/test.html.erb")

        assert_match(/\A[0-9a-f]{12}\z/, visitor.identifier)
        refute_includes visitor.identifier, "views"
      end

      test "lets a caller name a template however it likes" do
        visitor = Herb::Engine::SlotVisitor.new(identifier: ->(path) { "v1/#{path.length}" })

        Herb::Engine.new("<p><%= @a %></p>", visitors: [visitor], filename: "app/views/test.html.erb")

        assert_equal "v1/23", visitor.identifier
      end

      test "keeps the real path for the server, whatever the markers say" do
        visitor = Herb::Engine::SlotVisitor.new(identifier: :digest)

        Herb::Engine.new("<p><%= @a %></p>", visitors: [visitor], filename: "app/views/test.html.erb")

        assert_equal "app/views/test.html.erb", visitor.schema[:file]
        assert_equal visitor.identifier, visitor.schema[:identifier]
      end

      test "a conditional whose branches lay out the same is not a conditional at all" do
        assert_equal(
          [[0, :child]],
          types_for("<% if @c %><h1><%= @today %></h1><% else %><h1><%= @tomorrow %></h1><% end %>")
        )
      end

      test "the branches share the slots written on their elements too" do
        assert_equal(
          [[0, :attribute], [1, :child]],
          types_for(%(<% if @c %><li class="<%= @a %>"><%= @x %></li><% else %><li class="<%= @b %>"><%= @y %></li><% end %>))
        )
      end

      test "collapses an elsif chain when every arm lays out the same" do
        assert_equal(
          [[0, :child]],
          types_for("<% if @a %><p><%= @x %></p><% elsif @b %><p><%= @y %></p><% else %><p><%= @z %></p><% end %>")
        )
      end

      test "collapses the arms of a case" do
        assert_equal(
          [[0, :child]],
          types_for("<% case @s %><% when 1 %><p><%= @x %></p><% else %><p><%= @y %></p><% end %>")
        )
      end

      test "keeps a conditional that can render nothing" do
        assert_equal(
          [[0, :conditional], [1, :child], [2, :child]],
          types_for("<% if @a %><p><%= @x %></p><% elsif @b %><p><%= @y %></p><% end %>")
        )

        assert_equal([[0, :conditional], [1, :child]], types_for("<% if @a %><p><%= @x %></p><% end %>"))
      end

      test "keeps a conditional whose branches differ in what they write" do
        assert_equal(
          [[0, :conditional], [1, :child], [2, :child]],
          types_for("<% if @c %><h1>a<%= @x %></h1><% else %><h1>b<%= @y %></h1><% end %>")
        )

        assert_equal(
          [[0, :conditional], [1, :child], [2, :child]],
          types_for("<% if @c %><h1><%= @x %></h1><% else %><h2><%= @y %></h2><% end %>")
        )
      end

      test "keeps a conditional whose branches hold different numbers of slots" do
        assert_equal(
          [[0, :conditional], [1, :child], [2, :child], [3, :child]],
          types_for("<% if @c %><p><%= @x %></p><% else %><p><%= @y %><%= @z %></p><% end %>")
        )
      end

      test "keeps a conditional that contains another one" do
        assert_equal(
          [[0, :conditional], [1, :conditional], [2, :child], [3, :conditional], [4, :child]],
          types_for("<% if @c %><p><% if @d %><%= @x %><% end %></p><% else %><p><% if @e %><%= @y %><% end %></p><% end %>")
        )
      end

      test "records what a block whose value is not output contains" do
        assert_slots_snapshot("<div><% @user.tap do |u| %><b><%= u.name %></b><% end %></div>")
      end
    end
  end
end
