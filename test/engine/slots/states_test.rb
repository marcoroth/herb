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
        error.diagnostics.map(&:message)
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

      def diagnostic_for(template)
        error = assert_raises(Herb::Engine::CompilationError) { compile(template) }

        error.diagnostics.first #: as !nil
      end

      def refuse(template, message)
        error = assert_raises(Herb::Engine::CompilationError) { compile(template) }

        assert_equal [message], compiler_findings(error)
      end

      test "compile errors" do
        refuse(
          "<%# herb:state (open:) %><p><%= open %></p>",
          "The `herb:state` directive only declares keyword arguments with defaults. `open:` is not one. Declare each state with a default, like `(pending: false)`."
        )

        refuse(
          "<%# herb:state (rate: 1.0) %><p><%= rate %></p>",
          "The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text."
        )

        refuse(
          "<%# herb:state (rate: 1e3) %><p><%= rate %></p>",
          "The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text."
        )

        refuse(
          "<%# herb:state (selected: []) %><p><%= selected %></p>",
          "The state `selected` has an Array default. A list on the page is a collection of items, not one state holding many values."
        )

        refuse(
          "<%# herb:state (draft: { title: \"\" }) %><p><%= draft %></p>",
          "The state `draft` has a Hash default. A state holds one value the client can write and read back."
        )

        refuse(
          "<%# herb:state (open: open_initially) %><p><%= open %></p>",
          "The state `open` defaults to `open_initially`, which is not a declared strict local. A name that was never passed raises at render."
        )

        refuse(
          "<%# locals: (open: false) %>\n<%# herb:state (open: false) %><p><%= open %></p>",
          "`open` is both a strict local and a state. A local comes from the caller and a state is owned by the client, so the name has two owners."
        )

        refuse(
          "<ul><% @items.each do |item| %><%# herb:state (open: false) %><li id=\"<%= item %>\"><%= open %></li><% end %></ul>" \
          "<%# herb:state (open: false) %>",
          "The state `open` is declared in both an item and its region, so a later read could mean either one."
        )

        refuse(
          "<%# herb:state (sort: \"name\") %><div><% if sort == 3 %>a<% end %></div>",
          "`sort == 3` compares the String state `sort` against an Integer literal, so it can never match."
        )

        refuse(
          "<%# herb:state (sort: \"name\") %><div><% case sort %><% when SORTS %>a<% end %></div>",
          "`when SORTS` on the state `sort` has a comparand that is not a literal. The client resolves a `when` by lookup."
        )
      end

      test "a `when` against a literal of another kind is refused" do
        refuse(
          "<%# herb:state (sort: \"name\") %><div><% case sort %><% when 3 %>a<% end %></div>",
          "`when 3` compares the String state `sort` against a literal of another type, so it can never match."
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
          "`@admin` sits in a state-driven conditional but reads no state. The client resolves every arm, so an arm it cannot answer would never be chosen."
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

      test "the `?` spelling reads a state for its truth, the way the bare name does" do
        {
          %(<%# herb:state (pending: false) %><div><% if pending? %>x<% end %></div>) => ["pending", nil],
          %(<%# herb:state (missing: nil) %><div><% if missing? %>x<% end %></div>) => ["missing", nil],
        }.each do |template, condition|
          visitor, = compile(template)

          assert_equal({ arms: [arm(0, condition)], else: nil }, visitor.state_conditional_entries.fetch(0))
        end
      end

      test "a state that can never be falsy is refused as a condition, in either spelling" do
        refuse(
          %(<%# herb:state (message: "hi") %><div><% if message %>x<% end %></div>),
          "`message` reads the String state `message` as a presence. Only `nil` and `false` are falsy in Ruby, so the condition is always true."
        )

        refuse(
          %(<%# herb:state (attempts: 0) %><div><% if attempts? %>x<% end %></div>),
          "`attempts?` reads the Integer state `attempts` as a presence. Only `nil` and `false` are falsy in Ruby, so the condition is always true."
        )
      end

      test "a mistake inside a boolean attribute is reported once" do
        [
          %(<%# herb:state (draft: "") %><div><button disabled="<%= draft == 3 %>">x</button></div>),
          %(<%# herb:state (draft: "") %><div><button disabled="<%= draft.nil? %>">x</button></div>),
          %(<%# herb:state (draft: "") %><div><button disabled="<%= draft %>">x</button></div>),
          %(<%# herb:state (count: 0) %><div><button disabled="<%= count.empty? %>">x</button></div>)
        ].each do |template|
          error = assert_raises(Herb::Engine::CompilationError) { compile(template) }

          assert_equal 1, error.diagnostics.size
        end
      end

      test "a nil check on a state that can never be nil is refused, in either spelling" do
        refuse(
          %(<%# herb:state (draft: "") %><div><% if draft.nil? %>x<% end %></div>),
          "`draft.nil?` reads the String state `draft` as a nil check. Only a Nil state can be nil, so it can never match."
        )

        refuse(
          %(<%# herb:state (draft: "") %><div><% if draft == nil %>x<% end %></div>),
          "`draft == nil` reads the String state `draft` as a nil check. Only a Nil state can be nil, so it can never match."
        )

        refuse(
          %(<%# herb:state (draft: "") %><div><% if draft != nil %>x<% end %></div>),
          "`draft != nil` reads the String state `draft` as a nil check. Only a Nil state can be nil, so it always matches."
        )
      end

      test "a nil check compiles for the kinds that really can be nil" do
        {
          %(<%# herb:state (missing: nil) %><div><% if missing.nil? %>x<% end %></div>) => ["missing", { "value" => nil }],
          %(<%# herb:state (thing: @thing) %><div><% if thing.nil? %>x<% end %></div>) => ["thing", { "value" => nil }],
        }.each do |template, condition|
          visitor, = compile(template)

          assert_equal({ arms: [arm(0, condition)], else: nil }, visitor.state_conditional_entries.fetch(0))
        end
      end

      test "the way out names the predicates that can answer false for the state's kind" do
        assert_equal(
          "Ask `draft.empty?`, `.blank?` or `.present?`, compare it to a literal, like `draft == \"\"`, or declare it as a boolean.",
          diagnostic_for(%(<%# herb:state (draft: "") %><div><% if draft %>x<% end %></div>)).suggestion
        )

        assert_equal(
          "Ask `attempts.zero?`, `.one?` or `.positive?`, compare it to a literal, like `attempts == 0`, or declare it as a boolean.",
          diagnostic_for(%(<%# herb:state (attempts: 0) %><div><% if attempts %>x<% end %></div>)).suggestion
        )

        assert_equal(
          "Ask `tab.empty?`, compare it to a literal, like `tab == :first`, or declare it as a boolean.",
          diagnostic_for(%(<%# herb:state (tab: :first) %><div><% if tab %>x<% end %></div>)).suggestion
        )
      end

      test "an `unless` on a state that can never be falsy is refused the other way around" do
        refuse(
          %(<%# herb:state (tab: :first) %><div><% unless tab %>x<% end %></div>),
          "`unless tab` reads the Symbol state `tab` as a presence. Only `nil` and `false` are falsy in Ruby, so the condition is always false."
        )
      end

      test "the `?` spelling drops off the source the server runs" do
        rendered = render(%(<%# herb:state (pending: true) %><div><% if pending? %>Present<% else %>None<% end %></div>))

        assert_includes rendered, "Present"
      end

      test "a state mistake is coded under the directive it belongs to" do
        diagnostic = diagnostic_for(%(<%# herb:state (count: 0) %><div><% if count.empty? %>x<% end %></div>))

        assert_equal "herb-state-read", diagnostic.code
        assert_equal "Herb Compiler", diagnostic.origin
        assert_equal "Visitor", diagnostic.data[:validator]
      end

      test "a diagnostic carries a suggestion beside its message" do
        diagnostic = diagnostic_for(%(<%# herb:state (sort: "name") %><div><% if sort == 3 %>a<% end %></div>))

        assert_equal "`sort == 3` compares the String state `sort` against an Integer literal, so it can never match.", diagnostic.message
        assert_equal "Compare it against a String literal, like `sort == \"name\"`.", diagnostic.suggestion
      end

      test "a diagnostic points at the part of the expression that is wrong" do
        diagnostic = diagnostic_for(<<~ERB)
          <%# herb:state (draft: "") %>

          <% if draft.length > 3 && Current.user.admin? %>
            Long
          <% end %>
        ERB

        assert_equal 3, diagnostic.location&.start&.line
        assert_equal 26, diagnostic.location&.start&.column
        assert_equal 45, diagnostic.location&.end&.column
      end

      test "a combination naming server Ruby says which side the client cannot answer" do
        diagnostic = diagnostic_for(%(<%# herb:state (draft: "") %><div><% if draft.blank? || Current.user.admin? %>x<% end %></div>))

        assert_equal "`Current.user.admin?` is server Ruby inside a condition that also reads the state `draft`. The client resolves each side of `||` itself and has no value for this one.", diagnostic.message
        assert_equal "Move `Current.user.admin?` into its own conditional around this one, or declare a state for it and set it from app code.", diagnostic.suggestion
      end

      test "a predicate compiles into the comparison it stands for" do
        {
          %(<%# herb:state (draft: "") %><div><% if draft.empty? %>x<% end %></div>) => ["draft", { "value" => "" }],
          %(<%# herb:state (missing: nil) %><div><% if missing.nil? %>x<% end %></div>) => ["missing", { "value" => nil }],
          %(<%# herb:state (count: 0) %><div><% if count.zero? %>x<% end %></div>) => ["count", { "value" => 0 }],
          %(<%# herb:state (count: 0) %><div><% if count.one? %>x<% end %></div>) => ["count", { "value" => 1 }],
          %(<%# herb:state (count: 0) %><div><% if count.positive? %>x<% end %></div>) => ["count", { "value" => 0 }, ">"],
        }.each do |template, condition|
          visitor, = compile(template)

          assert_equal({ arms: [arm(0, condition)], else: nil }, visitor.state_conditional_entries.fetch(0))
        end
      end

      test "blank? and present? compile into operators the client resolves" do
        visitor, = compile(%(<%# herb:state (draft: "") %><div><% if draft.blank? %>x<% end %></div>))

        assert_equal({ arms: [arm(0, ["draft", nil, "blank"])], else: nil }, visitor.state_conditional_entries.fetch(0))

        visitor, = compile(%(<%# herb:state (draft: "") %><div><% if draft.present? %>x<% end %></div>))

        assert_equal({ arms: [arm(0, ["draft", nil, "present"])], else: nil }, visitor.state_conditional_entries.fetch(0))
      end

      test "one? rewrites for the server, since Ruby defines it on Enumerable" do
        rendered = render(%(<%# herb:state (count: 1) %><div><% if count.one? %>one<% else %>many<% end %></div>))

        assert_includes rendered, "one"
      end

      test "a predicate on a state of another kind is refused" do
        refuse(
          %(<%# herb:state (draft: "") %><div><% if draft.zero? %>x<% end %></div>),
          "`draft.zero?` reads the String state `draft` with `zero?`. Only an Integer state can be read with `zero?`."
        )

        refuse(
          %(<%# herb:state (count: 0) %><div><% if count.empty? %>x<% end %></div>),
          "`count.empty?` reads the Integer state `count` with `empty?`. Only a String or a Symbol state can be read with `empty?`."
        )

        refuse(
          %(<%# herb:state (count: 0) %><div><% if count.blank? %>x<% end %></div>),
          "`count.blank?` reads the Integer state `count` with `blank?`. Only a Boolean, a String or a Nil state can be read with `blank?`."
        )

        refuse(
          %(<%# herb:state (draft: "") %><div><% if draft.positive? %>x<% end %></div>),
          "`draft.positive?` reads the String state `draft` with `positive?`. Only an Integer state can be read with `positive?`."
        )

        refuse(
          %(<%# herb:state (tab: :first) %><div><% if tab.present? %>x<% end %></div>),
          "`tab.present?` reads the Symbol state `tab` with `present?`. Only a Boolean, a String or a Nil state can be read with `present?`."
        )
      end

      test "length and size compile into one transform on the read" do
        {
          %(<%# herb:state (draft: "") %><div><% if draft.length > 3 %>x<% end %></div>) => ["draft", { "value" => 3 }, ">", "length"],
          %(<%# herb:state (draft: "") %><div><% if draft.size > 3 %>x<% end %></div>) => ["draft", { "value" => 3 }, ">", "length"],
          %(<%# herb:state (draft: "") %><div><% if 3 < draft.length %>x<% end %></div>) => ["draft", { "value" => 3 }, ">", "length"],
          %(<%# herb:state (draft: "") %><div><% if draft.length == 0 %>x<% end %></div>) => ["draft", { "value" => 0 }, "==", "length"],
        }.each do |template, condition|
          visitor, = compile(template)

          assert_equal({ arms: [arm(0, condition)], else: nil }, visitor.state_conditional_entries.fetch(0))
        end
      end

      test "to_s reads a state of any kind as a String" do
        {
          %(<%# herb:state (draft: 3) %><div><% if draft.to_s == "3" %>x<% end %></div>) => ["draft", { "value" => "3" }, "==", "to_s"],
          %(<%# herb:state (open: false) %><div><% if open.to_s == "false" %>x<% end %></div>) => ["open", { "value" => "false" }, "==", "to_s"],
          %(<%# herb:state (note: nil) %><div><% if note.to_s == "" %>x<% end %></div>) => ["note", { "value" => "" }, "==", "to_s"],
          %(<%# herb:state (draft: "hi") %><div><% if draft.to_s == "hi" %>x<% end %></div>) => ["draft", { "value" => "hi" }, "==", "to_s"],
          %(<%# herb:state (tab: :first) %><div><% if tab.to_s == "first" %>x<% end %></div>) => ["tab", { "value" => "first" }, "==", "to_s"],
        }.each do |template, condition|
          visitor, = compile(template)

          assert_equal({ arms: [arm(0, condition)], else: nil }, visitor.state_conditional_entries.fetch(0))
        end
      end

      test "to_s renders what Ruby renders, for every kind" do
        {
          %(<%# herb:state (flag: true) %><p><%= flag.to_s %></p>) => ">true<",
          %(<%# herb:state (flag: false) %><p><%= flag.to_s %></p>) => ">false<",
          %(<%# herb:state (note: nil) %><p>[<%= note.to_s %>]</p>) => ">[<",
          %(<%# herb:state (draft: "hi") %><p><%= draft.to_s %></p>) => ">hi<",
          %(<%# herb:state (count: -5) %><p><%= count.to_s %></p>) => ">-5<",
          %(<%# herb:state (tab: :first) %><p><%= tab.to_s %></p>) => ">first<",
        }.each do |template, expected|
          assert_includes render(template), expected
        end
      end

      test "a transform compares against another state when only one side carries it" do
        visitor, = compile(%(<%# herb:state (draft: 3, filter: "all") %><div><% if draft.to_s == filter %>x<% end %></div>))

        assert_equal({ arms: [arm(0, ["draft", { "state" => "filter" }, "==", "to_s"])], else: nil }, visitor.state_conditional_entries.fetch(0))

        visitor, = compile(%(<%# herb:state (draft: 3, filter: "all") %><div><% if filter == draft.to_s %>x<% end %></div>))

        assert_equal({ arms: [arm(0, ["draft", { "state" => "filter" }, "==", "to_s"])], else: nil }, visitor.state_conditional_entries.fetch(0))

        visitor, = compile(%(<%# herb:state (draft: "", count: 0) %><div><% if count < draft.length %>x<% end %></div>))

        assert_equal({ arms: [arm(0, ["draft", { "state" => "count" }, ">", "length"])], else: nil }, visitor.state_conditional_entries.fetch(0))
      end

      test "a length read stands alone as a computed value slot" do
        visitor, = compile(%(<%# herb:state (draft: "") %><p><%= draft.length %></p>))

        assert_equal ["draft", nil, nil, "length"], encoded(visitor.state_values.fetch(0))
      end

      test "a length read derives an Integer state" do
        visitor, = compile(%(<%# herb:state (draft: "", width: draft.length) %><p><%= width %></p>))
        entries = visitor.state_entries.to_h { |entry| [entry[:name], entry] }

        assert_equal :integer, entries.fetch("width")[:kind]
        assert_equal ["draft", nil, nil, "length"], encoded(entries.fetch("width")[:derived])
      end

      test "length renders the server's answer" do
        rendered = render(%(<%# herb:state (draft: "hello") %><p><%= draft.length %></p>))

        assert_includes rendered, ">5<"
      end

      test "length on a state of another kind is refused" do
        refuse(
          %(<%# herb:state (count: 0) %><div><% if count.length > 3 %>x<% end %></div>),
          "`count.length` reads the Integer state `count` with `length`. Only a String or a Symbol state can be read with `length`."
        )

        refuse(
          %(<%# herb:state (count: 0) %><div><% if count.size > 3 %>x<% end %></div>),
          "`count.size` reads the Integer state `count` with `size`. Only a String or a Symbol state can be read with `size`."
        )
      end

      test "a transform on both sides carries one on the comparand" do
        visitor, = compile(%(<%# herb:state (draft: "", other: "") %><div><% if draft.length > other.length %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, ["draft", { "state" => "other", "transform" => "length" }, ">", "length"])], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )

        visitor, = compile(%(<%# herb:state (draft: "", other: "") %><div><% if draft.to_s == other.to_s %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, ["draft", { "state" => "other", "transform" => "to_s" }, "==", "to_s"])], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "two transformed sides render for the server" do
        rendered = render(%(<%# herb:state (draft: "abc", other: "ab") %><div><% if draft.length > other.length %>longer<% end %></div>))

        assert_includes rendered, "longer"
      end

      test "two transformed sides keep their kinds compatible" do
        refuse(
          %(<%# herb:state (draft: "", other: "") %><div><% if draft.length > other.to_s %>x<% end %></div>),
          "`draft.length > other.to_s` orders the length of the state `draft` against the to_s of the state `other`. Ordering compares numbers."
        )
      end

      test "a transform compared against a state of another kind is refused" do
        refuse(
          %(<%# herb:state (draft: "", filter: "all") %><div><% if draft.length > filter %>x<% end %></div>),
          "`draft.length > filter` orders the length of the state `draft` against the String state `filter`. Ordering compares numbers."
        )
      end

      test "`!` negates the read it wraps" do
        {
          %(<%# herb:state (open: false) %><div><% if !open %>x<% end %></div>) => ["open", nil, "falsy"],
          %(<%# herb:state (open: false) %><div><% if not open %>x<% end %></div>) => ["open", nil, "falsy"],
          %(<%# herb:state (open: false) %><div><% if !open? %>x<% end %></div>) => ["open", nil, "falsy"],
          %(<%# herb:state (open: false) %><div><% if !!open %>x<% end %></div>) => ["open", nil],
          %(<%# herb:state (draft: "") %><div><% if !(draft == "hi") %>x<% end %></div>) => ["draft", { "value" => "hi" }, "!="],
          %(<%# herb:state (count: 0) %><div><% if !(count > 3) %>x<% end %></div>) => ["count", { "value" => 3 }, "<="],
          %(<%# herb:state (draft: "") %><div><% if !draft.blank? %>x<% end %></div>) => ["draft", nil, "present"],
          %(<%# herb:state (draft: "") %><div><% if !draft.present? %>x<% end %></div>) => ["draft", nil, "blank"],
          %(<%# herb:state (count: 0) %><div><% if !count.zero? %>x<% end %></div>) => ["count", { "value" => 0 }, "!="],
          %(<%# herb:state (draft: "") %><div><% if !(draft.length > 3) %>x<% end %></div>) => ["draft", { "value" => 3 }, "<=", "length"],
        }.each do |template, condition|
          visitor, = compile(template)

          assert_equal({ arms: [arm(0, condition)], else: nil }, visitor.state_conditional_entries.fetch(0))
        end
      end

      test "a read is rewritten where it is code and left alone everywhere else" do
        {
          [" draft? ", "draft"] => " draft ",
          [" !open? ", "open"] => " !open ",
          [" count.one? ", "count"] => " (count == 1) ",
          [' draft == "draft?" ', "draft"] => ' draft == "draft?" ',
          [' draft == "count.one?" ', "count"] => ' draft == "count.one?" ',
          [" \"\#{draft?} draft?\" ", "draft"] => " \"\#{draft} draft?\" ",
          [" :draft? ", "draft"] => " :draft? ",
          [" foo.draft? ", "draft"] => " foo.draft? ",
          [" item.draft? && draft? ", "draft"] => " item.draft? && draft ",
          [" foo.count.one? ", "count"] => " foo.count.one? ",
        }.each do |(source, name), rewritten|
          assert_equal rewritten, Herb::Engine::Slots::StateDirectives.rewrite_reads(source, name)
        end
      end

      test "two predicates in one tag both rewrite, after the first shifts the source" do
        template = %(<%# herb:state (pending: false, failed: false) %><div><% if pending? && failed? %>x<% end %></div>)
        _, src = compile(template)

        assert_equal "if pending && failed;", src[/if pending[^;]*;/]
      end

      test "a call on a receiver that spells a state name is not a read" do
        template = <<~ERB
          <%# herb:state (draft: "") %>
          <ul><% @items.each do |item| %><%# herb:key item %><li id="i<%= item %>"><%= item.draft %></li><% end %></ul>
        ERB

        visitor, = compile(template)

        assert_empty visitor.state_values
        assert_empty visitor.state_presence
      end

      test "a string literal that spells a predicate keeps its `?` in the server's comparison" do
        template = %(<%# herb:state (draft: "draft?") %><p><%= draft == "draft?" %></p>)
        visitor, = compile(template)

        assert_equal ["draft", { "value" => "draft?" }], encoded(visitor.state_values.fetch(0))

        assert_equal(
          %(<!--herb-region:app/views/test.html.erb:a560d282:0--><p data-herb-slot="0:child">true</p><!--/herb-region:app/views/test.html.erb-->),
          render(template)
        )
      end

      test "a negated predicate read evaluates on the server" do
        assert_equal(
          %(<!--herb-region:app/views/test.html.erb:50a4b7a7:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:0-->x<!--/herb-slot:0--></div><!--/herb-region:app/views/test.html.erb--><template data-herb-region="app/views/test.html.erb:50a4b7a7"><!--herb-branch:0:0-->x</template>),
          render(%(<%# herb:state (open: false) %><div><% if !open? %>x<% end %></div>))
        )
      end

      test "a negated read renders for the server" do
        rendered = render(%(<%# herb:state (open: false) %><button disabled="<%= !open %>">Send</button>))

        assert_includes rendered, "<button disabled"
      end

      test "a negated combination distributes over its parts" do
        visitor, = compile(%(<%# herb:state (open: false, draft: "") %><div><% if !(open && draft == "hi") %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, { "any" => [["open", nil, "falsy"], ["draft", { "value" => "hi" }, "!="]] })], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )

        visitor, = compile(%(<%# herb:state (open: false, draft: "") %><div><% if !(open || draft == "hi") %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, { "all" => [["open", nil, "falsy"], ["draft", { "value" => "hi" }, "!="]] })], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a negation nests through a combination" do
        visitor, = compile(%(<%# herb:state (message: "", count: 0) %><div><% if !((message.length > count) && !(message == "abc" || count == 0)) %>x<% end %></div>))

        assert_equal(
          {
            arms: [arm(0, {
              "any" => [
                ["message", { "state" => "count" }, "<=", "length"],
                { "any" => [["message", { "value" => "abc" }, "=="], ["count", { "value" => 0 }, "=="]] }
              ],
            })],
            else: nil,
          },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a predicate combines with a comparison in one condition" do
        visitor, = compile(%(<%# herb:state (sending: false, draft: "") %><div><% if sending? && draft == "hello" %>x<% end %></div>))

        assert_equal(
          { arms: [arm(0, { "all" => [["sending", nil], ["draft", { "value" => "hello" }]] })], else: nil },
          visitor.state_conditional_entries.fetch(0)
        )
      end

      test "a combo of predicates derives a state" do
        visitor, = compile(%(<%# herb:state (sending: false, draft: "", ready: sending? && draft.present?) %><div><% if ready %>x<% end %></div>))
        entries = visitor.state_entries.to_h { |entry| [entry[:name], entry] }

        assert_equal :boolean, entries.fetch("ready")[:kind]
        assert_equal({ "all" => [["sending", nil], ["draft", nil, "present"]] }, encoded(entries.fetch("ready")[:derived]))
      end

      test "a predicate derives a state from the one it reads" do
        visitor, = compile(%(<%# herb:state (draft: "", empty: draft.blank?) %><div><% if empty %>x<% end %></div>))
        entries = visitor.state_entries.to_h { |entry| [entry[:name], entry] }

        assert_equal :boolean, entries.fetch("empty")[:kind]
        assert_equal ["draft", nil, "blank"], encoded(entries.fetch("empty")[:derived])
      end

      test "a predicate in a boolean attribute becomes a presence" do
        visitor, = compile(%(<%# herb:state (draft: "") %><button disabled="<%= draft.blank? %>">Send</button>))

        assert_equal :boolean_attribute, visitor.slots.fetch(0).type
        assert_equal ["draft", nil, "blank"], encoded(visitor.state_presence.fetch(0))
      end

      test "a comparison in an output becomes a computed value slot" do
        visitor, = compile(%(<%# herb:state (draft: "") %><p><%= draft == "hello" %></p>))

        assert_equal ["draft", { "value" => "hello" }], encoded(visitor.state_values.fetch(0))
      end

      test "a computed value slot renders the answer the server computed" do
        rendered = render(%(<%# herb:state (draft: "") %><p><%= draft == "" %></p>))

        assert_includes rendered, ">true<"
      end

      test "a computed read in a textarea becomes a server read" do
        visitor, = compile(%(<%# herb:state (draft: "") %><textarea><%= draft.upcase %></textarea>))

        assert_equal({ "draft" => [{ "index" => 0, "node_path" => [1, 0] }] }, visitor.manifest["states"]["server"]["reads"])
      end

      test "a string literal that spells a state name is not a read" do
        visitor, = compile(%(<%# herb:state (draft: "") %><p><%= "draft" %></p>))

        assert_empty visitor.state_values
        assert_empty visitor.state_presence
      end

      test "a string literal that spells a counted state is not a read inside its loop" do
        visitor, = compile(<<~ERB)
          <%# herb:state (total: 0) %>
          <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><li id="i<%= item %>"><%= "total" %></li><% end %></ul>
        ERB

        assert_equal [{ name: "total", collection: 0, by: 1, when: nil }], visitor.state_count_entries
      end

      test "a second directive in the same scope is refused, since one declaration owns the scope" do
        error = assert_raises(Herb::Engine::ParseError) do
          compile("<%# herb:state (open: false) %><%# herb:state (other: true) %><p><%= open %></p>")
        end

        assert_includes error.message, "This scope already declares its states."
      end

      test "a trim-marker state directive is refused, since one spelling declares states" do
        error = assert_raises(Herb::Engine::ParseError) do
          compile(%(<%#- herb:state (open: false) -%><span><%= open %></span>))
        end

        assert_includes error.message, "The `herb:state` directive has to be spelled `<%# herb:state (...) %>`."
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
          ["`status` reads a state inside an interpolated attribute that mixes other dynamic parts. A state write cannot supply the other values."],
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
          "`sort != 3` compares the String state `sort` against an Integer literal, so it always matches."
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
          "`sort == attempts` compares the String state `sort` with the Integer state `attempts`, so it can never match."
        )

        refuse(
          "<%# herb:state (sort: \"name\", other: \"x\") %><div><% if sort > other %>x<% end %></div>",
          "`sort > other` orders the String state `sort` against the String state `other`. Ordering compares numbers."
        )
      end

      test "a boolean attribute compares two states" do
        rendered = render(%(<%# herb:state (counter1: 1, counter2: 1) %><video muted="<%= counter1 == counter2 %>"></video>))

        assert_includes rendered, "<video muted"
      end

      test "ordering refuses non-integer states and comparands" do
        refuse(
          "<%# herb:state (sort: \"name\") %><div><% if sort > \"a\" %>x<% end %></div>",
          "`sort > \"a\"` orders the String state `sort`. Ordering compares numbers."
        )

        refuse(
          "<%# herb:state (attempts: 0) %><div><% if attempts > \"a\" %>x<% end %></div>",
          "`attempts > \"a\"` orders the state `attempts` against a String literal. Ordering compares numbers."
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
          "`current_user.admin?` is server Ruby inside a condition that also reads the state `pending`. The client resolves each side of `&&` itself and has no value for this one."
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
          "The state `busy` defaults to `pending || current_user.admin?`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none."
        )

        refuse(
          %(<%# herb:state (attempts: 0, doubled: attempts + 1) %><p><%= attempts %></p>),
          "The state `doubled` defaults to `attempts + 1`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none."
        )
      end

      test "a derived state cannot read forward" do
        refuse(
          %(<%# herb:state (busy: pending || failed, pending: false, failed: false) %><p><%= pending %></p>),
          "The state `busy` reads a state declared after it. A derived state reads only states declared before it."
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
          "The state `mirror` reads `open` from an enclosing scope. A derived state reads only states from its own signature."
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
          "`pending = true` assigns the state `pending`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered."
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
          "`total += 1` assigns the state `total`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered."
        )
      end

      test "a count read before or inside its loop raises" do
        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>
            <p><%= total %></p>
            <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`total` is read before its count is complete. The server renders that read mid-count and the client cannot keep it current."
        )

        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>
            <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><li id="i<%= item %>"><%= total %></li><% end %></ul>
          ERB
          "`total` is read inside the loop that counts it. The count is complete only after the loop."
        )
      end

      test "a count needs an integer region state counted once" do
        refuse(
          <<~ERB,
            <%# herb:state (label: "x") %>
            <ul><% @items.each do |item| %><%# herb:key item %><% label += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`label += 1` counts into the String state `label`. A count is a number."
        )

        refuse(
          <<~ERB,
            <%# herb:slots client %>
            <ul><% @items.each do |item| %><%# herb:key item %><%# herb:state (mine: 0) %><% mine += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`mine += 1` counts into `mine`, which is an item state. A count lives once per region, not once per item."
        )

        refuse(
          <<~ERB,
            <%# herb:state (total: 0) %>
            <ul><% @items.each do |item| %><%# herb:key item %><% total += 1 %><% total += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
            <p><%= total %></p>
          ERB
          "`total` is counted twice. One state holds one count."
        )
      end

      test "a count cannot target a derived state" do
        refuse(
          <<~ERB,
            <%# herb:state (pending: false, busy: pending) %>
            <ul><% @items.each do |item| %><%# herb:key item %><% busy += 1 %><li id="i<%= item %>"><%= item %></li><% end %></ul>
          ERB
          "`busy += 1` counts into `busy`, which is derived from `pending`. A state is either derived or counted, never both."
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

      test "a computed tag helper attribute becomes a server read" do
        visitor, = compile(%(<%# herb:slots client %><%# herb:state (draft: "") %><%= tag.input value: draft.upcase %>))

        assert_equal ["draft"], visitor.manifest["states"]["server"]["reads"].keys
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
          ["`unless attempts * 2 > 3` computes with the state `attempts`. The client resolves each condition itself and cannot run Ruby to pick a branch."],
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
          ["`muted=\"<%= status %>\"` reads the String state `status` as a presence. Only `nil` and `false` are falsy in Ruby, so the attribute could never turn off."],
          compiler_findings(error)
        )
      end

      test "a computed read in a boolean attribute becomes a server read" do
        visitor, = compile(<<~ERB)
          <%# herb:state (draft: "") %>
          <button disabled="<%= draft.upcase %>">Send</button>
        ERB

        assert_equal ["draft"], visitor.manifest["states"]["server"]["reads"].keys
      end

      test "a value computing with a region state becomes a server read" do
        visitor, = compile(%(<%# herb:state (q: "") %><p><%= User.search(q).count %></p>))

        assert_equal({ "q" => [{ "index" => 0, "node_path" => [1, 0] }] }, visitor.manifest["states"]["server"]["reads"])
        assert_empty visitor.diagnostics
      end

      test "a keyed collection computing with a region state becomes a server read" do
        visitor, = compile(<<~ERB)
          <%# herb:state (q: "") %>
          <ul>
          <% @messages.search(q).each do |message| %>
            <%# herb:key message.id %>
            <li id="<%= message.id %>"><%= message.body %></li>
          <% end %>
          </ul>
        ERB

        reads = visitor.manifest["states"]["server"]["reads"]

        assert_equal ["q"], reads.keys
        assert_equal 1, reads["q"].length
        assert_empty visitor.diagnostics
      end

      test "a collection reading no region state registers nothing" do
        visitor, = compile(<<~ERB)
          <%# herb:state (q: "") %>
          <ul>
          <% @messages.each do |message| %>
            <%# herb:key message.id %>
            <li id="<%= message.id %>"><%= message.body %></li>
          <% end %>
          </ul>
        ERB

        assert_empty visitor.manifest["states"]["server"]["reads"]
      end

      test "a value computing with an item state still raises" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(<<~ERB)
            <% @posts.each do |post| %>
              <%# herb:state (likes: 0) %>
              <li id="<%= post.id %>"><%= likes * 2 %></li>
            <% end %>
          ERB
        end

        assert_includes error.message, "which lives on an item"
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
