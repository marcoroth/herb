# frozen_string_literal: true

require "nokogiri"

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slot_visitor"

module Engine
  module Slots
    class MarkersTest < Minitest::Spec
      include SnapshotUtils

      def options
        { visitors: [Herb::Engine::SlotVisitor.new], filename: "app/views/test.html.erb" }
      end

      def parse_slotted(template, locals)
        Nokogiri::HTML5.fragment(evaluate_herb_source(Herb::Engine.new(template, **options).src, locals))
      end

      def item_marker_parents(document)
        parents = []

        document.traverse do |node|
          parents << [node.text, node.parent.name] if node.comment? && node.text.include?("herb-item")
        end

        parents
      end

      test "anchors a child slot to its element when the slot is the whole content" do
        assert_evaluated_snapshot(%(<td class="name"><%= @name %></td>), { "@name" => "Marco" }, options)
      end

      test "keeps paired comments when a child slot shares its element with text" do
        assert_evaluated_snapshot("<p>Hi <%= @name %>!</p>", { "@name" => "Marco" }, options)
      end

      test "keeps paired comments when an element holds several slots" do
        assert_evaluated_snapshot("<div><%= @a %><%= @b %></div>", { "@a" => "x", "@b" => "y" }, options)
      end

      test "keeps paired comments for a slot that can render nothing" do
        assert_evaluated_snapshot("<div><% if @admin %>x<% end %></div>", { "@admin" => false }, options)
      end

      test "distinguishes an element's attribute slot from its content slot" do
        assert_evaluated_snapshot(
          %(<li class="<%= @c %>"><%= @name %></li>),
          { "@c" => "item", "@name" => "Marco" },
          options
        )
      end

      test "names the type on a marker for everything that is not a child" do
        assert_evaluated_snapshot("<div><% if @admin %>x<% end %></div>", { "@admin" => true }, options)
      end

      test "names the type on an element anchor" do
        assert_evaluated_snapshot(%(<div <%= @attrs %>>x</div>), { "@attrs" => "id=\"1\"" }, options)
      end

      test "delimits a child slot with paired comments" do
        assert_evaluated_snapshot("<p><%= @name %></p>", { "@name" => "Marco" }, options)
      end

      test "gives sibling interpolations independent slots" do
        assert_evaluated_snapshot(
          "<p>Hi <%= @name %>, you have <%= @count %></p>",
          { "@name" => "Marco", "@count" => 3 },
          options
        )
      end

      test "leaves an empty addressable position when a conditional is false" do
        assert_evaluated_snapshot(
          "<div><% if @admin %><b>secret</b><% end %></div>",
          { "@admin" => false },
          options
        )
      end

      test "delimits slots nested inside another slot" do
        assert_evaluated_snapshot(
          "<div><% if @admin %><b><%= @secret %></b><% end %></div>",
          { "@admin" => true, "@secret" => "s" },
          options
        )
      end

      test "a nested slot only exists once its parent branch renders" do
        assert_evaluated_snapshot(
          "<div><% if @admin %><b><%= @secret %></b><% end %></div>",
          { "@admin" => false, "@secret" => "s" },
          options
        )
      end

      test "anchors attribute slots on the element instead of inside the tag" do
        assert_evaluated_snapshot(%(<div class="<%= @klass %>"></div>), { "@klass" => "card" }, options)
      end

      test "does not inject markers into raw text elements" do
        assert_evaluated_snapshot(%(<script>var a = "<%= @a %>";</script>), { "@a" => "1" }, options)
      end

      test "wraps the document in a region marker carrying file and version" do
        assert_evaluated_snapshot("<p><%= @name %></p>", { "@name" => "x" }, options)
      end

      test "compiles slot markers into the generated source" do
        assert_compiled_snapshot("<p><%= @name %></p>", options)
      end

      test "compiles a conditional into the generated source" do
        assert_compiled_snapshot("<div><% if @admin %><b><%= @secret %></b><% end %></div>", options)
      end

      test "compiles a collection into the generated source" do
        assert_compiled_snapshot("<ul><% @items.each do |item| %><li><%= item %></li><% end %></ul>", options)
      end

      test "compiles attribute slots into the generated source" do
        assert_compiled_snapshot(%(<div class="<%= @c %>" id="<%= @i %>"></div>), options)
      end

      test "treats an if/elsif/else chain as one conditional slot" do
        assert_evaluated_snapshot(
          "<div><% if @a %>A<% elsif @b %><%= @n %><% else %>C<% end %></div>",
          { "@a" => false, "@b" => true, "@n" => "N" },
          options
        )
      end

      test "delimits a slot inside an unless/else" do
        assert_evaluated_snapshot(
          "<div><% unless @a %><%= @n %><% else %>E<% end %></div>",
          { "@a" => false, "@n" => "N" },
          options
        )
      end

      test "delimits a slot inside a when branch" do
        assert_evaluated_snapshot(
          "<div><% case @x %><% when 1 %><%= @a %><% end %></div>",
          { "@x" => 1, "@a" => "A" },
          options
        )
      end

      test "delimits a slot inside a case else branch" do
        assert_evaluated_snapshot(
          "<div><% case @x %><% when 9 %>N<% else %><%= @a %><% end %></div>",
          { "@x" => 1, "@a" => "A" },
          options
        )
      end

      test "gives a conditional nested inside an else its own slot" do
        assert_evaluated_snapshot(
          "<div><% if @a %>A<% else %><% if @b %><%= @n %><% end %><% end %></div>",
          { "@a" => false, "@b" => true, "@n" => "N" },
          options
        )
      end

      test "gives a conditional nested inside an elsif its own slot" do
        assert_evaluated_snapshot(
          "<div><% if @a %>A<% elsif @b %><% if @c %><%= @n %><% end %><% end %></div>",
          { "@a" => false, "@b" => true, "@c" => true, "@n" => "N" },
          options
        )
      end

      test "delimits a collection nested inside an else" do
        assert_evaluated_snapshot(
          "<div><% if @a %>A<% else %><% @l.each do |i| %><%= i %><% end %><% end %></div>",
          { "@a" => false, "@l" => [1] },
          options
        )
      end

      test "delimits nested collections" do
        assert_evaluated_snapshot(
          "<% @items.each do |item| %><% item.each do |cell| %><%= cell %><% end %><% end %>",
          { "@items" => [[1, 2]] },
          options
        )
      end

      test "delimits a collection body with several slots" do
        assert_evaluated_snapshot(
          "<ul><% @users.each do |u| %><li><%= u %> (<%= u %>)</li><% end %></ul>",
          { "@users" => ["a", "b"] },
          options
        )
      end

      test "anchors several attribute slots on the same element" do
        assert_evaluated_snapshot(
          %(<div class="<%= @c %>" id="<%= @i %>"></div>),
          { "@c" => "C", "@i" => "I" },
          options
        )
      end

      test "anchors an interpolated attribute value" do
        assert_evaluated_snapshot(%(<div class="a <%= @c %> b"></div>), { "@c" => "C" }, options)
      end

      test "delimits raw output" do
        assert_evaluated_snapshot("<p><%== @h %></p>", { "@h" => "<b>x</b>" }, options)
      end

      test "does not assign a slot to an ERB comment" do
        assert_evaluated_snapshot("<p><%# skip %><%= @a %></p>", { "@a" => "A" }, options)
      end

      test "preserves surrounding whitespace" do
        assert_evaluated_snapshot("<div>\n  <h1><%= @t %></h1>\n</div>", { "@t" => "T" }, options)
      end

      test "delimits a slot with no surrounding element" do
        assert_evaluated_snapshot("<%= @a %>", { "@a" => "A" }, options)
      end

      test "emits only a region marker when there are no slots" do
        assert_evaluated_snapshot("<div>static</div>", {}, options)
      end

      test "delimits a yield" do
        assert_compiled_snapshot("<main><%= yield %></main>", options)
      end

      test "keeps head content free of injected elements" do
        assert_evaluated_snapshot(
          %(<head><meta name="a" content="b"><title><%= @t %></title></head>),
          { "@t" => "T" },
          options
        )
      end

      test "keeps SVG subtrees free of injected elements" do
        assert_evaluated_snapshot(
          %(<svg viewBox="0 0 1 1"><circle r="<%= @r %>"></circle></svg>),
          { "@r" => "4" },
          options
        )
      end

      test "keeps adjacent siblings adjacent for CSS combinators" do
        assert_evaluated_snapshot(
          %(<div><input class="peer"><%= @x %><p class="peer-checked:block">y</p></div>),
          { "@x" => "" },
          options
        )
      end

      test "delimits a dynamic HTML comment from the outside" do
        assert_evaluated_snapshot("<!-- Content: <%= @c %> -->", { "@c" => "X" }, options)
      end

      test "delimits a conditional inside an HTML comment" do
        assert_evaluated_snapshot("<!-- <% if @a %>yes<% end %> -->", { "@a" => true }, options)
      end

      test "does not delimit a static HTML comment" do
        assert_evaluated_snapshot("<!-- just a note --><p><%= @a %></p>", { "@a" => "A" }, options)
      end

      test "never emits a wrapper element" do
        [
          ["<p><%= @x %></p>", { "@x" => "a" }],
          ["<div><% if @x %><b>y</b><% end %></div>", { "@x" => true }],
          ["<ul><% @x.each do |i| %><li>i</li><% end %></ul>", { "@x" => ["a"] }]
        ].each do |template, locals|
          engine = Herb::Engine.new(template, **options)
          output = evaluate_herb_source(engine.src, locals)

          refute_includes output, "<span", "expected no wrapper element for: #{template}"
          refute_includes output, "display: contents"
        end
      end

      test "keeps markers out of a tag for ERB in element position" do
        assert_evaluated_snapshot(%(<div <%= @a %>>x</div>), { "@a" => %(id="y") }, options)
      end

      test "keeps markers out of RCDATA content" do
        assert_evaluated_snapshot("<textarea><%= @a %></textarea>", { "@a" => "A" }, options)
      end

      test "delimits a for loop" do
        assert_evaluated_snapshot(
          "<% for x in @l %><b><%= x %></b><% end %>",
          { "@l" => [1] },
          options
        )
      end

      test "delimits each item of a keyed collection" do
        assert_evaluated_snapshot(
          %(<% @users.each do |user| %><li herb-key="<%= user[:id] %>"><%= user[:name] %></li><% end %>),
          { "@users" => [{ id: 1, name: "Marco" }, { id: 2, name: "Alice" }] },
          options
        )
      end

      test "does not delimit items of an unkeyed collection" do
        assert_evaluated_snapshot(
          "<% @users.each do |user| %><li><%= user[:name] %></li><% end %>",
          { "@users" => [{ id: 1, name: "Marco" }] },
          options
        )
      end

      test "delimits items of a body with several roots via the herb:key directive" do
        assert_evaluated_snapshot(
          %(<% @users.each do |user| %><%# herb:key user[:id] %><dt><%= user[:name] %></dt><dd><%= user[:email] %></dd><% end %>),
          { "@users" => [{ id: 1, name: "Marco", email: "marco@example.com" }] },
          options
        )
      end

      test "delimits items of a body with no element at all" do
        assert_evaluated_snapshot(
          %(<% @users.each do |user| %><%# herb:key user[:id] %><%= user[:name] %><% end %>),
          { "@users" => [{ id: 1, name: "Marco" }, { id: 2, name: "Alice" }] },
          options
        )
      end

      test "names the branch of an if/elsif/else that rendered" do
        assert_evaluated_snapshot(
          "<% if @a %>A<% elsif @b %>B<% else %>C<% end %>",
          { "@a" => false, "@b" => true },
          options
        )
      end

      test "names the else branch that rendered" do
        assert_evaluated_snapshot(
          "<% if @a %>A<% elsif @b %>B<% else %>C<% end %>",
          { "@a" => false, "@b" => false },
          options
        )
      end

      test "names the case branch that rendered" do
        assert_evaluated_snapshot(
          "<% case @x %><% when 1 %>ONE<% else %>OTHER<% end %>",
          { "@x" => 9 },
          options
        )
      end

      test "names no branch when a conditional renders nothing" do
        assert_evaluated_snapshot("<% if @a %>A<% end %>", { "@a" => false }, options)
      end

      test "keeps nested collection items distinguishable" do
        assert_evaluated_snapshot(
          %(<% @items.each do |item| %><tr id="<%= item[:id] %>"><% item[:cells].each do |cell| %><td id="<%= cell %>"><%= cell %></td><% end %></tr><% end %>),
          { "@items" => [{ id: 1, cells: [11, 12] }] },
          options
        )
      end

      test "renders the same content as an unslotted template" do
        template = %(<div class="a"><h1><%= @title %></h1><% if @admin %><b>x</b><% end %></div>)
        locals = { "@title" => "T", "@admin" => true }

        slotted = evaluate_herb_source(Herb::Engine.new(template, **options).src, locals)
        plain = evaluate_herb_source(Herb::Engine.new(template).src, locals)

        unmarked = slotted
                   .gsub(%r{<!--/?herb-(slot|region|item|branch)[^>]*-->}, "")
                   .gsub(/ data-herb-(child|slot)="[^"]*"/, "")

        assert_equal plain, unmarked
      end

      test "a table collection has its item markers split across table and tbody" do
        document = parse_slotted(
          %(<table><% @items.each do |item| %><tr id="<%= item %>"><td>x</td></tr><% end %></table>),
          { "@items" => [1] }
        )

        assert_equal [["herb-item:0:1", "table"], ["/herb-item:0", "tbody"]], item_marker_parents(document)
      end

      test "an explicit tbody keeps an item's markers under one parent" do
        document = parse_slotted(
          %(<table><tbody><% @items.each do |item| %><tr id="<%= item %>"><td>x</td></tr><% end %></tbody></table>),
          { "@items" => [1] }
        )

        assert_equal [["herb-item:0:1", "tbody"], ["/herb-item:0", "tbody"]], item_marker_parents(document)
      end

      def rendered(template, locals)
        evaluate_herb_source(Herb::Engine.new(template, **options).src, locals)
      end

      test "renders the same markers whichever branch of a same-shaped conditional runs" do
        template = "<% if @c %><h1><%= @today %></h1><% else %><h1><%= @tomorrow %></h1><% end %>"
        locals = { "@today" => "Mon", "@tomorrow" => "Tue" }

        taken = rendered(template, locals.merge("@c" => true))
        untaken = rendered(template, locals.merge("@c" => false))

        assert_equal taken.sub("Mon", "?"), untaken.sub("Tue", "?")
        refute_includes taken, "herb-branch"
      end

      test "collapses a same-shaped conditional to one slot" do
        assert_evaluated_snapshot(
          "<% if @c %><h1><%= @today %></h1><% else %><h1><%= @tomorrow %></h1><% end %>",
          { "@c" => false, "@today" => "Mon", "@tomorrow" => "Tue" },
          options
        )
      end

      test "keeps the conditional when the branches do not lay out the same" do
        assert_evaluated_snapshot(
          "<% if @c %><h1><%= @today %></h1><% else %><h2><%= @tomorrow %></h2><% end %>",
          { "@c" => false, "@today" => "Mon", "@tomorrow" => "Tue" },
          options
        )
      end
    end
  end
end
