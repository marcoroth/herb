# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class SlotMarkersTest < Minitest::Spec
    include SnapshotUtils

    OPTIONS = { slots: true, filename: "app/views/test.html.erb", validation_mode: :none }.freeze

    test "delimits a child slot with paired comments" do
      assert_evaluated_snapshot("<p><%= @name %></p>", { "@name" => "Marco" }, OPTIONS)
    end

    test "gives sibling interpolations independent slots" do
      assert_evaluated_snapshot(
        "<p>Hi <%= @name %>, you have <%= @count %></p>",
        { "@name" => "Marco", "@count" => 3 },
        OPTIONS
      )
    end

    test "leaves an empty addressable position when a conditional is false" do
      assert_evaluated_snapshot(
        "<div><% if @admin %><b>secret</b><% end %></div>",
        { "@admin" => false },
        OPTIONS
      )
    end

    test "delimits slots nested inside another slot" do
      assert_evaluated_snapshot(
        "<div><% if @admin %><b><%= @secret %></b><% end %></div>",
        { "@admin" => true, "@secret" => "s" },
        OPTIONS
      )
    end

    test "a nested slot only exists once its parent branch renders" do
      assert_evaluated_snapshot(
        "<div><% if @admin %><b><%= @secret %></b><% end %></div>",
        { "@admin" => false, "@secret" => "s" },
        OPTIONS
      )
    end

    test "anchors attribute slots on the element instead of inside the tag" do
      assert_evaluated_snapshot(%(<div class="<%= @klass %>"></div>), { "@klass" => "card" }, OPTIONS)
    end

    test "does not inject markers into raw text elements" do
      assert_evaluated_snapshot(%(<script>var a = "<%= @a %>";</script>), { "@a" => "1" }, OPTIONS)
    end

    test "wraps the document in a region marker carrying file and version" do
      assert_evaluated_snapshot("<p><%= @name %></p>", { "@name" => "x" }, OPTIONS)
    end

    test "compiles slot markers into the generated source" do
      assert_compiled_snapshot("<p><%= @name %></p>", OPTIONS)
    end

    test "compiles a conditional into the generated source" do
      assert_compiled_snapshot("<div><% if @admin %><b><%= @secret %></b><% end %></div>", OPTIONS)
    end

    test "compiles a collection into the generated source" do
      assert_compiled_snapshot("<ul><% @items.each do |item| %><li><%= item %></li><% end %></ul>", OPTIONS)
    end

    test "compiles attribute slots into the generated source" do
      assert_compiled_snapshot(%(<div class="<%= @c %>" id="<%= @i %>"></div>), OPTIONS)
    end

    test "treats an if/elsif/else chain as one conditional slot" do
      assert_evaluated_snapshot(
        "<div><% if @a %>A<% elsif @b %><%= @n %><% else %>C<% end %></div>",
        { "@a" => false, "@b" => true, "@n" => "N" },
        OPTIONS
      )
    end

    test "delimits a slot inside an unless/else" do
      assert_evaluated_snapshot(
        "<div><% unless @a %><%= @n %><% else %>E<% end %></div>",
        { "@a" => false, "@n" => "N" },
        OPTIONS
      )
    end

    test "delimits a slot inside a when branch" do
      assert_evaluated_snapshot(
        "<div><% case @x %><% when 1 %><%= @a %><% end %></div>",
        { "@x" => 1, "@a" => "A" },
        OPTIONS
      )
    end

    test "delimits a slot inside a case else branch" do
      assert_evaluated_snapshot(
        "<div><% case @x %><% when 9 %>N<% else %><%= @a %><% end %></div>",
        { "@x" => 1, "@a" => "A" },
        OPTIONS
      )
    end

    test "gives a conditional nested inside an else its own slot" do
      assert_evaluated_snapshot(
        "<div><% if @a %>A<% else %><% if @b %><%= @n %><% end %><% end %></div>",
        { "@a" => false, "@b" => true, "@n" => "N" },
        OPTIONS
      )
    end

    test "gives a conditional nested inside an elsif its own slot" do
      assert_evaluated_snapshot(
        "<div><% if @a %>A<% elsif @b %><% if @c %><%= @n %><% end %><% end %></div>",
        { "@a" => false, "@b" => true, "@c" => true, "@n" => "N" },
        OPTIONS
      )
    end

    test "delimits a collection nested inside an else" do
      assert_evaluated_snapshot(
        "<div><% if @a %>A<% else %><% @l.each do |i| %><%= i %><% end %><% end %></div>",
        { "@a" => false, "@l" => [1] },
        OPTIONS
      )
    end

    test "delimits nested collections" do
      assert_evaluated_snapshot(
        "<% @rows.each do |row| %><% row.each do |cell| %><%= cell %><% end %><% end %>",
        { "@rows" => [[1, 2]] },
        OPTIONS
      )
    end

    test "delimits a collection body with several slots" do
      assert_evaluated_snapshot(
        "<ul><% @users.each do |u| %><li><%= u %> (<%= u %>)</li><% end %></ul>",
        { "@users" => ["a", "b"] },
        OPTIONS
      )
    end

    test "anchors several attribute slots on the same element" do
      assert_evaluated_snapshot(
        %(<div class="<%= @c %>" id="<%= @i %>"></div>),
        { "@c" => "C", "@i" => "I" },
        OPTIONS
      )
    end

    test "anchors an interpolated attribute value" do
      assert_evaluated_snapshot(%(<div class="a <%= @c %> b"></div>), { "@c" => "C" }, OPTIONS)
    end

    test "delimits raw output" do
      assert_evaluated_snapshot("<p><%== @h %></p>", { "@h" => "<b>x</b>" }, OPTIONS)
    end

    test "does not assign a slot to an ERB comment" do
      assert_evaluated_snapshot("<p><%# skip %><%= @a %></p>", { "@a" => "A" }, OPTIONS)
    end

    test "preserves surrounding whitespace" do
      assert_evaluated_snapshot("<div>\n  <h1><%= @t %></h1>\n</div>", { "@t" => "T" }, OPTIONS)
    end

    test "delimits a slot with no surrounding element" do
      assert_evaluated_snapshot("<%= @a %>", { "@a" => "A" }, OPTIONS)
    end

    test "emits only a region marker when there are no slots" do
      assert_evaluated_snapshot("<div>static</div>", {}, OPTIONS)
    end

    test "delimits a yield" do
      assert_compiled_snapshot("<main><%= yield %></main>", OPTIONS)
    end

    test "keeps head content free of injected elements" do
      assert_evaluated_snapshot(
        %(<head><meta name="a" content="b"><title><%= @t %></title></head>),
        { "@t" => "T" },
        OPTIONS
      )
    end

    test "keeps SVG subtrees free of injected elements" do
      assert_evaluated_snapshot(
        %(<svg viewBox="0 0 1 1"><circle r="<%= @r %>"></circle></svg>),
        { "@r" => "4" },
        OPTIONS
      )
    end

    test "keeps adjacent siblings adjacent for CSS combinators" do
      assert_evaluated_snapshot(
        %(<div><input class="peer"><%= @x %><p class="peer-checked:block">y</p></div>),
        { "@x" => "" },
        OPTIONS
      )
    end

    test "delimits a dynamic HTML comment from the outside" do
      assert_evaluated_snapshot("<!-- Content: <%= @c %> -->", { "@c" => "X" }, OPTIONS)
    end

    test "delimits a conditional inside an HTML comment" do
      assert_evaluated_snapshot("<!-- <% if @a %>yes<% end %> -->", { "@a" => true }, OPTIONS)
    end

    test "does not delimit a static HTML comment" do
      assert_evaluated_snapshot("<!-- just a note --><p><%= @a %></p>", { "@a" => "A" }, OPTIONS)
    end

    test "never emits a wrapper element" do
      [
        ["<p><%= @x %></p>", { "@x" => "a" }],
        ["<div><% if @x %><b>y</b><% end %></div>", { "@x" => true }],
        ["<ul><% @x.each do |i| %><li>i</li><% end %></ul>", { "@x" => ["a"] }]
      ].each do |template, locals|
        engine = Herb::Engine.new(template, **OPTIONS)
        output = evaluate_herb_source(engine.src, locals)

        refute_includes output, "<span", "expected no wrapper element for: #{template}"
        refute_includes output, "display: contents"
      end
    end

    test "renders the same content as an unslotted template" do
      template = %(<div class="a"><h1><%= @title %></h1><% if @admin %><b>x</b><% end %></div>)
      locals = { "@title" => "T", "@admin" => true }

      slotted = evaluate_herb_source(Herb::Engine.new(template, **OPTIONS).src, locals)
      plain = evaluate_herb_source(Herb::Engine.new(template, validation_mode: :none).src, locals)

      assert_equal plain, slotted.gsub(%r{<!--/?herb-(slot|region)[^>]*-->}, "")
    end
  end
end
