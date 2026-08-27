# frozen_string_literal: true

require "json"
require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/slots/dynamics_compiler"

module Engine
  module Slots
    class StatesTest < Minitest::Spec
      include SnapshotUtils

      def compile(template)
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client)
        engine = Herb::Engine.new(template, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor, engine.src]
      end

      def render(template, locals = {})
        _, src = compile(template)

        evaluate_herb_source(src, locals)
      end

      def encoded(read)
        Herb::Engine::Slots::StateDirectives.condition_entry(read)
      end

      def arm(branch, condition)
        { "branch" => branch, "condition" => condition }
      end

      def parked(template, locals = {})
        render(template, locals)[%r{<template data-herb-region="[^"]+">(.*)</template>}m, 1].to_s
      end

      def compiler_findings(error)
        error.message.gsub(/\e\[[0-9;]*m/, "").scan(/slots-\w+: (.+)/).flatten
      end

      STATUS = <<~ERB
        <%# herb:state (pending: false, failed: false) %>
        <div><% if pending? %>Sending…<% elsif failed? %>Not sent<% else %>Sent<% end %></div>
      ERB

      test "renders every state as its default" do
        rendered = render("<%# herb:state (attempts: 0, draft: \"hi\") %><p><%= attempts %>-<%= draft %></p>")

        assert_includes rendered, ">0<!--/herb-slot:0-->-<!--herb-slot:1-->hi<"
      end

      test "rendered rows take the else arm while every arm is parked" do
        rendered = render(STATUS)

        assert_includes rendered, "Sent"
        refute_includes rendered.sub(/<template.*template>/m, ""), "Sending…"

        markup = parked(STATUS)

        assert_includes markup, "Sending…"
        assert_includes markup, "Not sent"
        assert_includes markup, "Sent"
      end

      test "a default that selects an arm still parks every arm" do
        template = <<~ERB
          <%# herb:state (tab: "profile") %>
          <div><% if tab == "profile" %>Profile<% elsif tab == "settings" %>Settings<% else %>None<% end %></div>
        ERB

        rendered = render(template)

        assert_includes rendered, "Profile"

        markup = parked(template)

        assert_includes markup, "Settings"
        assert_includes markup, "None"
      end

      test "a conditional with no else parks its one arm" do
        template = %(<%# herb:state (open: false) %><div><% if open? %><nav>menu</nav><% end %></div>)

        assert_includes parked(template), "menu"
      end

      test "records the arm table against the slot it belongs to" do
        visitor, = compile(STATUS)
        conditional = visitor.state_conditional_entries.fetch(0)

        assert_equal [arm(0, ["pending", nil]), arm(1, ["failed", nil])], conditional[:arms]
        assert_equal 2, conditional[:else]
      end

      test "if with equality and case produce the same arm table" do
        equality = <<~ERB
          <%# herb:state (sort: "name") %>
          <div><% if sort == "name" %>a<% elsif sort == "date" %>b<% else %>c<% end %></div>
        ERB
        cased = <<~ERB
          <%# herb:state (sort: "name") %>
          <div><% case sort %><% when "name" %>a<% when "date" %>b<% else %>c<% end %></div>
        ERB

        arms = lambda { |template|
          visitor, = compile(template)
          conditional = visitor.state_conditional_entries.fetch(0)
          [conditional[:arms], conditional[:else]]
        }

        assert_equal arms.call(equality), arms.call(cased)
      end

      test "the declarations are part of the version" do
        plain = compile("<div><%= @a %></div>").first.version
        stated = compile("<%# herb:state (open: false) %><div><%= @a %></div>").first.version

        refute_equal plain, stated
      end

      test "a state read in an item scope declares per item" do
        template = <<~ERB
          <ul><% @items.each do |item| %><%# herb:state (selected: false) %><li id="<%= item %>"><% if selected? %>*<% else %>-<% end %></li><% end %></ul>
        ERB

        visitor, = compile(template)

        assert_equal(["selected"], visitor.state_declarations[:items].values.flatten.map { |declaration| declaration[:name] })
        assert_includes render(template, { "@items" => ["a"] }), "-"
      end

      test "a seeded default from a declared strict local compiles and coerces booleans" do
        template = <<~ERB
          <%# locals: (open_initially: false) %>
          <%# herb:state (open: open_initially) %>
          <div><% if open? %>yes<% else %>no<% end %></div>
        ERB

        visitor, src = compile(template)

        assert_equal "!!(open_initially)", src[/= (!!\(open_initially\))/, 1]
        assert_equal :boolean, visitor.state_declarations[:region].first[:kind]
      end

      test "an ivar default compiles" do
        visitor, = compile("<%# herb:state (open: @seed) %><div><% if open %>a<% else %>b<% end %></div>")

        assert_equal :seeded, visitor.state_declarations[:region].first[:kind]
      end

      def refuse(template, message)
        error = assert_raises(Herb::Engine::CompilationError) { compile(template) }

        assert_equal [message], compiler_findings(error)
      end

      test "compile errors" do
        refuse(
          "<%# herb:state (open:) %><p><%= open %></p>",
          "The state `open` has no default. Give it one, since the server renders a value for every state, like `(open: false)`."
        )

        refuse(
          "<%# herb:state (rate: 1.0) %><p><%= rate %></p>",
          "The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so declare it as an Integer or a String instead."
        )

        refuse(
          "<%# herb:state (selected: []) %><p><%= selected %></p>",
          "The state `selected` has an Array default. A list on the page is a collection of items, so declare an item-scoped boolean inside the loop instead."
        )

        refuse(
          "<%# herb:state (draft: { title: \"\" }) %><p><%= draft %></p>",
          "The state `draft` has a Hash default. Declare each leaf as its own state, like `(draft_title: \"\")`."
        )

        refuse(
          "<%# herb:state (open: open_initially) %><p><%= open %></p>",
          "The state `open` defaults to `open_initially`, which is not a declared strict local. A name that was never passed raises at render, so add `open_initially` to the `locals:` signature."
        )

        refuse(
          "<%# locals: (open: false) %>\n<%# herb:state (open: false) %><p><%= open %></p>",
          "`open` is both a strict local and a state. A local comes from the caller and a state is owned by the client, so rename one of the two."
        )

        refuse(
          "<%# herb:state (open: false) %><%# herb:state (open: true) %><p><%= open %></p>",
          "The state `open` is declared twice in the same scope. Remove one of the two declarations."
        )

        refuse(
          "<ul><% @items.each do |item| %><%# herb:state (open: false) %><li id=\"<%= item %>\"><%= open %></li><% end %></ul>" \
          "<%# herb:state (open: false) %>",
          "The state `open` is declared in both an item and its region. A later read could mean either one, so give them different names."
        )

        refuse(
          "<%# herb:state (attempts: 0) %><p><%= attempts + 1 %></p>",
          "`attempts + 1` computes with a state. The client cannot evaluate Ruby, so read the state bare, or compare it to a literal in a conditional or a boolean attribute."
        )

        refuse(
          "<%# herb:state (sort: \"name\") %><div><% if sort == 3 %>a<% end %></div>",
          "`sort == 3` compares the String state `sort` against an Integer literal, so it can never match. Compare it against a String literal instead."
        )

        refuse(
          "<%# herb:state (attempts: 0) %><div><% if attempts? %>a<% end %></div>",
          "`attempts?` reads the Integer state `attempts` as a predicate. Only a boolean state can be read with a `?`, so drop the `?` or declare `attempts` as a boolean."
        )

        refuse(
          "<%# herb:state (sort: \"name\") %><div><% case sort %><% when SORTS %>a<% end %></div>",
          "`when SORTS` on the state `sort` has a comparand that is not a literal. The client resolves a `when` by lookup, so compare against literals only."
        )
      end

      test "a `when` against a literal of another kind is refused" do
        refuse(
          "<%# herb:state (sort: \"name\") %><div><% case sort %><% when 3 %>a<% end %></div>",
          "`when 3` compares the String state `sort` against a literal of another type, so it can never match. Compare it against a String literal instead."
        )
      end

      test "a seeded state may be compared in a `when`, as it may with `==`" do
        seeded = %(<%# herb:state (filter: @filter) %><div><% case filter %><% when "all" %>a<% else %>b<% end %></div>)
        equality = %(<%# herb:state (filter: @filter) %><div><% if filter == "all" %>a<% else %>b<% end %></div>)

        assert_equal :seeded, compile(seeded).first.state_declarations[:region].first[:kind]
        assert_equal :seeded, compile(equality).first.state_declarations[:region].first[:kind]
      end

      test "a mixed conditional refuses the arm that reads no state" do
        refuse(
          "<%# herb:state (pending: false) %><div><% if pending? %>a<% elsif @admin %>b<% else %>c<% end %></div>",
          "`@admin` sits in a state-driven conditional but reads no state. The client resolves every arm, so read a state here or move this branch out of the conditional."
        )
      end

      test "a template with no states compiles exactly as before" do
        visitor, = compile("<div><% if @a %>a<% else %>b<% end %></div>")

        assert_empty visitor.state_declarations[:region]
        assert_empty visitor.state_conditional_entries
      end

      test "a predicate read in a plain attribute rewrites for the server" do
        rendered = render(%(<%# herb:state (pending: false) %><div class="<%= pending? %>">x</div>))

        assert_includes rendered, 'class="false"'
      end

      test "a state declared inside an else arm is registered" do
        rendered = render(%(<% if @a %>x<% else %><%# herb:state (open: false) %><span><%= open %></span><% end %>), { "@a" => false })

        assert_includes rendered, "<span"
      end

      test "a state declared inside a when arm is registered" do
        template = %(<% case @x %><% when 1 %><%# herb:state (open: false) %><span><%= open %></span><% end %>)
        rendered = render(template, { "@x" => 1 })

        assert_includes rendered, "<span"
      end

      test "a case on a predicate spelling rewrites its subject" do
        rendered = render(%(<%# herb:state (pending: false) %><div><% case pending? %><% when true %>a<% else %>b<% end %></div>))

        assert_includes rendered, "b"
      end

      test "a predicate read in a textarea rewrites for the server" do
        rendered = render(%(<%# herb:state (pending: false) %><textarea><%= pending? %></textarea>))

        assert_includes rendered, "false</textarea>"
      end

      test "a computed read in a textarea still raises" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (draft: "") %><textarea><%= draft.upcase %></textarea>))
        end

        assert_equal(
          ["`draft.upcase` computes with a state. The client cannot evaluate Ruby, so read the state bare, or compare it to a literal in a conditional or a boolean attribute."],
          compiler_findings(error)
        )
      end

      test "a trim-marker state directive still declares" do
        rendered = render(%(<%#- herb:state (open: false) -%><span><%= open %></span>))

        assert_includes rendered, "<span"
      end

      test "a state read compiles as an interpolated attribute's only output" do
        rendered = render(%(<%# herb:state (status: "") %><div class="row-<%= status %>">x</div>))

        assert_includes rendered, 'class="row-"'
      end

      test "a predicate read in an interpolated attribute rewrites for the server" do
        rendered = render(%(<%# herb:state (pending: false) %><div class="row-<%= pending? %>">x</div>))

        assert_includes rendered, 'class="row-false"'
      end

      test "a state mixed with other dynamics in an interpolated attribute is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (status: "") %><div class="row-<%= status %>-<%= @kind %>">x</div>))
        end

        assert_equal(
          ["`status` reads a state inside an interpolated attribute that mixes other dynamic parts. A state write cannot supply the other values, so give the state its own attribute or its own output."],
          compiler_findings(error)
        )
      end

      test "an ordered comparison compiles with its operator in the arm" do
        visitor, = compile(%(<%# herb:state (attempts: 0) %><div><% if attempts > 3 %>Many<% else %>Few<% end %></div>))

        assert_equal({ arms: [arm(0, ["attempts", { "value" => 3 }, ">"])], else: 1 }, visitor.state_conditional_entries.fetch(0))
      end

      test "a reversed ordered comparison mirrors its operator" do
        visitor, = compile(%(<%# herb:state (attempts: 0) %><div><% if 3 < attempts %>Many<% end %></div>))

        assert_equal({ arms: [arm(0, ["attempts", { "value" => 3 }, ">"])], else: nil }, visitor.state_conditional_entries.fetch(0))
      end

      test "an ordered presence carries its operator" do
        visitor, = compile(%(<%# herb:state (attempts: 0) %><video muted="<%= attempts >= 2 %>"></video>))
        read = visitor.state_presence.fetch(0)

        assert_equal ">=", read.operator

        rendered = render(%(<%# herb:state (attempts: 5) %><video muted="<%= attempts >= 2 %>"></video>))

        assert_includes rendered, "<video muted"
      end

      test "a negated equality compiles for any kind" do
        visitor, = compile(%(<%# herb:state (sort: "name") %><div><% if sort != "date" %>Named<% end %></div>))

        assert_equal({ arms: [arm(0, ["sort", { "value" => "date" }, "!="])], else: nil }, visitor.state_conditional_entries.fetch(0))

        refuse(
          "<%# herb:state (sort: \"name\") %><div><% if sort != 3 %>x<% end %></div>",
          "`sort != 3` compares the String state `sort` against an Integer literal, so it can never match. Compare it against a String literal instead."
        )
      end

      test "a state compares against another state" do
        template = %(<%# herb:state (counter1: 0, counter2: 5) %><div><% if counter1 > counter2 %>Ahead<% else %>Behind<% end %></div>)
        visitor, = compile(template)

        assert_equal({ arms: [arm(0, ["counter1", { "state" => "counter2" }, ">"])], else: 1 }, visitor.state_conditional_entries.fetch(0))

        rendered = render(template)

        assert_includes rendered, "Behind"
      end

      test "a state pair keeps its kinds compatible" do
        refuse(
          "<%# herb:state (sort: \"name\", attempts: 0) %><div><% if sort == attempts %>x<% end %></div>",
          "`sort == attempts` compares the String state `sort` with the Integer state `attempts`, so it can never match. Compare states of the same kind."
        )

        refuse(
          "<%# herb:state (sort: \"name\", other: \"x\") %><div><% if sort > other %>x<% end %></div>",
          "`sort > other` orders the states `sort` and `other`. Ordering compares numbers, so declare both as Integers."
        )
      end

      test "a boolean attribute compares two states" do
        rendered = render(%(<%# herb:state (counter1: 1, counter2: 1) %><video muted="<%= counter1 == counter2 %>"></video>))

        assert_includes rendered, "<video muted"
      end

      test "ordering refuses non-integer states and comparands" do
        refuse(
          "<%# herb:state (sort: \"name\") %><div><% if sort > \"a\" %>x<% end %></div>",
          "`sort > \"a\"` orders the String state `sort`. Ordering compares numbers, so declare `sort` as an Integer or compare it with `==` instead."
        )

        refuse(
          "<%# herb:state (attempts: 0) %><div><% if attempts > \"a\" %>x<% end %></div>",
          "`attempts > \"a\"` orders the state `attempts` against a String literal. Ordering compares numbers, so compare it against an Integer literal instead."
        )
      end

      test "a conjunction compiles as an all combo" do
        template = %(<%# herb:state (counter1: 0, counter2: 5) %><div><% if counter1 > 0 && counter2 < 10 %>In<% else %>Out<% end %></div>)
        visitor, = compile(template)

        assert_equal(
          { arms: [arm(0, { "all" => [["counter1", { "value" => 0 }, ">"], ["counter2", { "value" => 10 }, "<"]] })], else: 1 },
          visitor.state_conditional_entries.fetch(0)
        )

        rendered = render(template)

        assert_includes rendered, "Out"

        markup = parked(template)

        assert_includes markup, "In"
      end

      test "a disjunction compiles as an any combo" do
        visitor, = compile(%(<%# herb:state (pending: false, failed: false) %><div><% if pending? || failed? %>Busy<% else %>Idle<% end %></div>))

        assert_equal(
          { arms: [arm(0, { "any" => [["pending", nil], ["failed", nil]] })], else: 1 },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a parenthesized combo nests" do
        visitor, = compile(%(<%# herb:state (pending: false, failed: false, attempts: 0) %><div><% if pending? && (failed? || attempts > 2) %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, { "all" => [["pending", nil], { "any" => [["failed", nil], ["attempts", { "value" => 2 }, ">"]] }] })], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a combo takes a state pair as one of its conditions" do
        visitor, = compile(%(<%# herb:state (counter1: 0, counter2: 5, pending: false) %><div><% if counter1 == counter2 && pending? %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, { "all" => [["counter1", { "state" => "counter2" }], ["pending", nil]] })], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a combo mixing a state with server code raises" do
        refuse(
          "<%# herb:state (pending: false) %><div><% if pending? && current_user.admin? %>x<% else %>y<% end %></div>",
          "`pending? && current_user.admin?` computes with a state. The client cannot evaluate Ruby, so read the state bare, as a predicate, or compared to a literal."
        )
      end

      test "a combo of server reads stays a server conditional" do
        visitor, = compile(%(<%# herb:state (pending: false) %><div><% if signed_in? && admin? %>x<% else %>y<% end %></div>))

        assert_empty visitor.state_conditional_entries
      end

      test "an unless reads a combo with its arms inverted" do
        visitor, = compile(%(<%# herb:state (pending: false, failed: false) %><div><% unless pending? || failed? %>Free<% end %></div>))

        assert_equal(
          { arms: [arm(nil, { "any" => [["pending", nil], ["failed", nil]] })], else: 0 },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a boolean attribute reads a combo" do
        template = %(<%# herb:state (pending: false, failed: false) %><input disabled="<%= pending? || failed? %>">)
        visitor, = compile(template)

        assert_instance_of Herb::Engine::Slots::StateDirectives::Combo, visitor.state_presence.fetch(0)

        off = render(template)

        refute_includes off, "<input disabled"

        on = render(%(<%# herb:state (pending: true, failed: false) %><input disabled="<%= pending? || failed? %>">))

        assert_includes on, "<input disabled"
      end

      test "a pure-state default declares a derived state" do
        visitor, = compile(<<~ERB)
          <%# herb:state (pending: false, failed: false, attempts: 0, sort: "name", busy: pending || failed, many: attempts > 2, named: sort == "name", total: attempts) %>
          <div><% if busy %>B<% end %></div>
        ERB

        entries = visitor.state_entries.to_h { |entry| [entry[:name], entry] }

        assert_equal :boolean, entries.fetch("busy")[:kind]
        assert_equal({ "any" => [["pending", nil], ["failed", nil]] }, encoded(entries.fetch("busy")[:derived]))
        assert_equal ["attempts", { "value" => 2 }, ">"], encoded(entries.fetch("many")[:derived])
        assert_equal ["sort", { "value" => "name" }], encoded(entries.fetch("named")[:derived])
        assert_equal :integer, entries.fetch("total")[:kind]
        assert_equal ["attempts", nil], encoded(entries.fetch("total")[:derived])
        assert_nil entries.fetch("pending")[:derived]
      end

      test "the server renders a derived state from its sources" do
        rendered = render(<<~ERB)
          <%# herb:state (pending: true, failed: false, busy: pending? || failed?) %>
          <div><% if busy %>Busy<% else %>Idle<% end %></div>
        ERB

        assert_includes rendered, "Busy"
      end

      test "a derived default mixing states with other Ruby raises" do
        refuse(
          %(<%# herb:state (pending: false, busy: pending || current_user.admin?) %><p><%= pending %></p>),
          "The state `busy` defaults to `pending || current_user.admin?`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none, so split the two apart."
        )

        refuse(
          %(<%# herb:state (attempts: 0, doubled: attempts + 1) %><p><%= attempts %></p>),
          "The state `doubled` defaults to `attempts + 1`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none, so split the two apart."
        )
      end

      test "a derived state cannot read forward" do
        refuse(
          %(<%# herb:state (busy: pending || failed, pending: false, failed: false) %><p><%= pending %></p>),
          "The state `busy` reads a state declared after it. A derived state reads only states declared before it, so move `busy` after the states it reads."
        )
      end

      test "an item state cannot derive from the region" do
        template = <<~ERB
          <%# herb:state (open: false) %>
          <ul>
            <% @rows.each do |row| %>
              <%# herb:key row.id %>
              <%# herb:state (mirror: open) %>
              <li id="<%= row.id %>"><%= row.name %></li>
            <% end %>
          </ul>
          <% if open? %>O<% end %>
        ERB

        refuse(
          template,
          "The state `mirror` reads `open` from an enclosing scope. A derived state reads only states from its own signature, so declare `mirror` beside the states it reads."
        )
      end

      test "a seed reading no state still compiles" do
        visitor, = compile(%(<%# herb:state (pending: false, hue: current_user.hue) %><p><%= pending %></p>))
        entries = visitor.state_entries.to_h { |entry| [entry[:name], entry] }

        assert_equal :seeded, entries.fetch("hue")[:kind]
        assert_nil entries.fetch("hue")[:derived]
      end

      COUNTED = <<~ERB
        <%# herb:slots client %>
        <%# herb:state (pending_count: 0) %>
        <ul>
          <% @messages.each do |message| %>
            <%# herb:key message %>
            <%# herb:state (pending: message.odd?) %>
            <% if pending? %><% pending_count = pending_count + 1 %><% end %>
            <li id="m<%= message %>"><%= message %></li>
          <% end %>
        </ul>
        <p><%= pending_count %></p>
      ERB

      test "a conditional increment compiles as a count" do
        visitor, = compile(COUNTED)

        assert_equal(
          [{ name: "pending_count", collection: 0, by: 1, when: ["pending", nil] }],
          visitor.state_count_entries
        )

        refute(visitor.slots.any? { |slot| slot.type == :conditional }, "the fold must not record a conditional slot")
      end

      test "the server renders the count the fold produces" do
        rendered = render(COUNTED, { "@messages" => [1, 2, 3] })

        assert_includes rendered, %(>2<)
      end

      test "a bare increment counts every item" do
        template = <<~ERB
          <%# herb:state (total: 0) %>
          <ul><% @items.each do |item| %><%# herb:key item %><% total += 2 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          <p><%= total %></p>
        ERB

        visitor, = compile(template)

        assert_equal [{ name: "total", collection: 0, by: 2, when: nil }], visitor.state_count_entries
        assert_includes render(template, { "@items" => [1, 2] }), %(>4<)
      end

      test "assigning a state outside a fold raises" do
        refuse(
          %(<%# herb:state (pending: false) %><div><% pending = true %><% if pending? %>A<% end %></div>),
          "`pending = true` assigns the state `pending`. The client never sees a server-side write, so seed the initial value in the declaration, derive it from other states, count items with `pending += 1` behind a state condition in a keyed loop, or write it at runtime with `data-herb-set` or `state.set`."
        )
      end

      test "a fold gated by a server condition raises" do
        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>

            <ul>
              <% @items.each do |item| %>
                <%# herb:key item %>

                <% if item.big? %>
                  <% total += 1 %>
                <% end %>

                <li id="i<%= item %>"><%= item %></li>
              <% end %>
            </ul>

            <p><%= total %></p>
          ERB
          "`total += 1` assigns the state `total`. The client never sees a server-side write, so seed the initial value in the declaration, derive it from other states, count items with `total += 1` behind a state condition in a keyed loop, or write it at runtime with `data-herb-set` or `state.set`."
        )
      end

      test "a count read before or inside its loop raises" do
        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>
            <p><%= total %></p>
            <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`total` is read before its count is complete. The server renders that read mid-count and the client cannot keep it current, so move the read after the loop."
        )

        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>
            <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><li id="i<%= item %>"><%= total %></li><% end %></ul>
          ERB
          "`total` is read inside the loop that counts it. The count is complete only after the loop, so move the read below it."
        )
      end

      test "a count needs an integer region state counted once" do
        refuse(
          <<~ERB,
            <%# herb:state (label: "x") %>
            <ul><% @items.each do |item| %><%# herb:key item %><% label += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`label += 1` counts into the String state `label`. A count is a number, so declare it as an Integer, like `(label: 0)`."
        )

        refuse(
          <<~ERB,
            <%# herb:slots client %>
            <ul><% @items.each do |item| %><%# herb:key item %><%# herb:state (mine: 0) %><% mine += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`mine += 1` counts into `mine`, which is an item state. A count lives once per region, so declare `mine` at the top of the template instead."
        )

        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>
            <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><% total += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
            <p><%= total %></p>
          ERB
          "`total` is counted twice. One state holds one count, so declare a second state for the second count."
        )
      end

      test "a count cannot target a derived state" do
        refuse(
          <<~ERB,
            <%# herb:state (pending: false, busy: pending) %>
            <ul><% @items.each do |item| %><%# herb:key item %><% busy += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`busy += 1` counts into `busy`, which is derived from `pending`. A state is either derived or counted, so drop the derivation or the count."
        )
      end

      test "a tag helper attribute reading a state is a bound slot" do
        template = %(<%# herb:slots client %><%# herb:state (draft: "") %><%= tag.input value: draft %>)
        visitor, = compile(template)
        slot = visitor.slots.fetch(0)

        assert_equal [:attribute, "value", "draft", "input"], [slot.type, slot.attribute, slot.expression, slot.tag]
        assert_includes render(template), %(<input value="" data-herb-slot="0:attribute:value">)
      end

      test "a tag helper boolean attribute reading a state renders presence" do
        template = %(<%# herb:slots client %><%# herb:state (agreed: true) %><%= tag.input type: "checkbox", checked: agreed %>)
        visitor, = compile(template)

        assert_equal :boolean_attribute, visitor.slots.fetch(0).type
        assert_equal "checked", visitor.slots.fetch(0).attribute
        assert visitor.state_presence.key?(0)
        assert_includes render(template), %(<input type="checkbox" checked data-herb-slot="0:boolean_attribute:checked">)

        off = render(%(<%# herb:slots client %><%# herb:state (agreed: false) %><%= tag.input type: "checkbox", checked: agreed %>))

        assert_includes off, %(<input type="checkbox" data-herb-slot="0:boolean_attribute:checked">)
      end

      test "a tag helper boolean attribute takes a predicate and a comparison" do
        rendered = render(%(<%# herb:slots client %><%# herb:state (pending: true) %><%= tag.button "Send", disabled: pending? %>))

        assert_includes rendered, %(<button disabled data-herb-slot="0:boolean_attribute:disabled">)

        rendered = render(%(<%# herb:slots client %><%# herb:state (sort: "name") %><%= tag.option "Name", value: "name", selected: sort == "name" %>))

        assert_includes rendered, %(<option value="name" selected data-herb-slot="0:boolean_attribute:selected">)
      end

      test "a tag helper boolean attribute on a server value stays a presence slot" do
        template = %(<%# herb:slots client %><%# herb:state (draft: "") %><%= tag.input disabled: done %>)
        visitor, = compile(template)

        assert_equal :boolean_attribute, visitor.slots.fetch(0).type
        refute visitor.state_presence.key?(0)
        assert_includes render(template, { "done" => true }), %(<input disabled data-herb-slot="0:boolean_attribute:disabled">)
        assert_includes render(template, { "done" => false }), %(<input data-herb-slot="0:boolean_attribute:disabled">)
      end

      test "a computed tag helper attribute raises" do
        refuse(
          %(<%# herb:slots client %><%# herb:state (draft: "") %><%= tag.input value: draft.upcase %>),
          "`draft.upcase` computes with a state. The client cannot evaluate Ruby, so read the state bare, or compare it to a literal in a conditional or a boolean attribute."
        )
      end

      SEEDED = <<~ERB
        <%# locals: (open_initially: false) %>
        <%# herb:slots client %>
        <%# herb:state (open: open_initially, label: @label, count: 0, busy: open) %>
        <div><% if busy %>Open<% else %>Closed<% end %></div>
        <ul>
          <% @messages.each do |message| %>
            <%# herb:key message %>
            <%# herb:state (pending: message.odd?, note: "x") %>
            <li id="m<%= message %>"><%= message %></li>
          <% end %>
        </ul>
      ERB

      def seeds_in(rendered)
        rendered.scan(/<!--herb-seeds:(.*?)-->/).flatten.map { |json| JSON.parse(json) }
      end

      test "the render ships the values of seeded states" do
        rendered = render(SEEDED, { "open_initially" => true, "@label" => "shipped", "@messages" => [1, 2] })

        assert_equal [{ "open" => true, "label" => "shipped" }, { "pending" => true }, { "pending" => false }], seeds_in(rendered)
      end

      test "the seeds marker survives a value containing a comment terminator" do
        rendered = render(SEEDED, { "open_initially" => false, "@label" => "a-->b", "@messages" => [] })

        assert_equal "a-->b", seeds_in(rendered).fetch(0).fetch("label")
        assert_includes rendered, "<!--herb-seeds:"
        refute_match(/<!--herb-seeds:[^>]*-->b/, rendered)
      end

      test "the seeds marker skips values the client cannot hold" do
        template = %(<%# herb:slots client %><%# herb:state (shape: @shape, name: @name) %><p><%= name %></p>)
        rendered = render(template, { "@shape" => [1, 2], "@name" => "n" })

        assert_equal [{ "name" => "n" }], seeds_in(rendered)

        only_shape = render(%(<%# herb:slots client %><%# herb:state (shape: @shape) %><p><%= shape %></p>), { "@shape" => [1, 2] })

        assert_includes only_shape, "<!--herb-seeds:{}-->"
      end

      test "a template with only literal defaults ships no seeds" do
        refute_includes render(STATUS), "herb-seeds"
      end

      test "the seeds marker writes to the buffer the engine was configured with" do
        template = %(<%# herb:slots client %><%# herb:state (label: @label) %><p><%= label %></p>)
        engine = Herb::Engine.new(
          template,
          visitors: [Herb::Engine::Slots::Visitor.new(mode: :client)],
          filename: "app/views/test.html.erb",
          bufvar: "@output_buffer"
        )

        assert_includes engine.src, '@output_buffer << ::Herb::Engine.raw("<!--herb-seeds:'
        refute_includes engine.src, "_buf <<"
      end

      test "the seeds marker survives a buffer that escapes what it appends" do
        buffer = Class.new(String) do
          def <<(value)
            super(value.respond_to?(:html_safe?) && value.html_safe? ? value : value.to_s.gsub("<", "&lt;"))
          end
        end

        assert_equal "<!--x-->", buffer.new.tap { |written| written << Herb::Engine.raw("<!--x-->") }.to_s
      end

      test "an unless reads a state with its arms inverted" do
        template = %(<%# herb:state (pending: false) %><div><% unless pending %>Idle<% else %>Busy<% end %></div>)
        visitor, = compile(template)

        assert_equal({ arms: [arm(1, ["pending", nil])], else: 0 }, visitor.state_conditional_entries.fetch(0))

        rendered = render(template)

        assert_includes rendered, "Idle"

        markup = parked(template)

        assert_includes markup, "Busy"
      end

      test "an unless with no else points its truthy arm at nothing" do
        visitor, = compile(%(<%# herb:state (pending: false) %><div><% unless pending %>Idle<% end %></div>))

        assert_equal({ arms: [arm(nil, ["pending", nil])], else: 0 }, visitor.state_conditional_entries.fetch(0))
      end

      test "a predicate unless rewrites for the server" do
        rendered = render(%(<%# herb:state (pending: false) %><div><% unless pending? %>Idle<% end %></div>))

        assert_includes rendered, "Idle"
      end

      test "a computed unless still raises" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (attempts: 0) %><div><% unless attempts * 2 > 3 %>Idle<% end %></div>))
        end

        assert_equal(
          ["`unless attempts * 2 > 3` computes with a state. The client cannot evaluate Ruby, so read the state bare, as a predicate, or compared to a literal."],
          compiler_findings(error)
        )
      end

      test "a negated state read in a conditional is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (open: false) %><% if !open %>x<% end %>))
        end

        assert_equal(
          ["`!open` computes with a state. The client cannot evaluate Ruby, so read the state bare, as a predicate, or compared to a literal."],
          compiler_findings(error)
        )
      end

      test "a keyed collection with item states parks its template only when empty" do
        template = <<~ERB
          <ul><% @items.each do |item| %><%# herb:key item %><%# herb:state (locked: true) %><li id="row_<%= item %>"><%= item %></li><% end %></ul>
        ERB

        refute_includes render(template, { "@items" => ["a"] }), "herb-branch:0:item"
        assert_includes parked(template, { "@items" => [] }), "herb-branch:0:item"
      end

      BOOLEAN_ATTRIBUTES = <<~ERB
        <%# herb:state (draft: "", sending: false) %>
        <button disabled="<%= draft == "" %>">Send</button>
        <video muted="<%= sending %>"></video>
        <audio loop="<%= sending? %>"></audio>
      ERB

      test "a boolean attribute reading a state renders presence" do
        rendered = render(BOOLEAN_ATTRIBUTES)

        assert_includes rendered, "<button disabled "
        refute_includes rendered, 'disabled="'
        refute_includes rendered, "<video muted"
        refute_includes rendered, "<audio loop"
      end

      test "a boolean attribute reading a state is retyped for the client" do
        rendered = render(BOOLEAN_ATTRIBUTES)

        assert_includes rendered, "0:boolean_attribute:disabled"
        assert_includes rendered, "1:boolean_attribute:muted"
        assert_includes rendered, "2:boolean_attribute:loop"
      end

      test "the visitor records what each presence compares" do
        visitor, = compile(BOOLEAN_ATTRIBUTES)

        assert_equal ["draft", %("")], [visitor.state_presence[0].name, visitor.state_presence[0].comparand]
        assert_equal ["sending", nil], [visitor.state_presence[1].name, visitor.state_presence[1].comparand]
        assert_equal ["sending", nil], [visitor.state_presence[2].name, visitor.state_presence[2].comparand]
      end

      test "the values payload carries presence as a boolean" do
        source = Herb::Engine::Slots::DynamicsCompiler.new(BOOLEAN_ATTRIBUTES, filename: "app/views/test.html.erb").src
        payload = evaluate_herb_source(source, {})

        assert_equal true, payload[:slots][0]
        assert_equal false, payload[:slots][1]
        assert_equal false, payload[:slots][2]
      end

      test "a boolean attribute reading no state keeps its value" do
        rendered = render(<<~ERB, "@locked": false)
          <%# herb:state (draft: "") %>
          <p><%= draft %></p>
          <button disabled="<%= @locked %>">Send</button>
        ERB

        assert_includes rendered, 'disabled="false"'
      end

      test "a bare non-boolean state in a boolean attribute raises" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (status: "") %><video muted="<%= status %>"></video>))
        end

        assert_equal(
          ["`muted=\"<%= status %>\"` reads the String state `status` as a presence. Only `nil` and `false` are falsy in Ruby, so the attribute could never turn off. Compare the state to a literal, or declare it as a boolean."],
          compiler_findings(error)
        )
      end

      test "a computed read in a boolean attribute still raises" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(<<~ERB)
            <%# herb:state (draft: "") %>
            <button disabled="<%= draft.empty? %>">Send</button>
          ERB
        end

        assert_includes error.message, "computes with a state"
      end

      test "a mismatched comparand in a boolean attribute still raises" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(<<~ERB)
            <%# herb:state (draft: "") %>
            <button disabled="<%= draft == 3 %>">Send</button>
          ERB
        end

        assert_includes error.message, "Integer literal"
      end
    end
  end
end
