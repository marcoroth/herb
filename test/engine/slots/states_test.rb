# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slot_visitor"
require_relative "../../../lib/herb/engine/dynamics_compiler"

module Engine
  module Slots
    class StatesTest < Minitest::Spec
      include SnapshotUtils

      def compile(template)
        visitor = Herb::Engine::SlotVisitor.new(mode: :client)
        engine = Herb::Engine.new(template, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor, engine.src]
      end

      def render(template, locals = {})
        _, src = compile(template)

        evaluate_herb_source(src, locals)
      end

      def parked(template, locals = {})
        render(template, locals)[%r{<template data-herb-region="[^"]+">(.*)</template>}m, 1].to_s
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

      test "records the arm table in the schema" do
        visitor, = compile(STATUS)
        entry = visitor.slot_entries.find { |candidate| candidate[:state_arms] }

        assert_equal [["pending", nil, 0], ["failed", nil, 1]], entry[:state_arms]
        assert_equal 2, entry[:state_else]
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
          entry = visitor.slot_entries.find { |candidate| candidate[:state_arms] }
          [entry[:state_arms], entry[:state_else]]
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

      def refuse(template, pattern)
        error = assert_raises(Herb::Engine::CompilationError) { compile(template) }

        assert_match(pattern, error.message)
      end

      test "compile errors" do
        refuse("<%# herb:state (open:) %><p><%= open %></p>", /no default/)
        refuse("<%# herb:state (rate: 1.0) %><p><%= rate %></p>", /Float/)
        refuse("<%# herb:state (selected: []) %><p><%= selected %></p>", /item-scoped boolean/)
        refuse("<%# herb:state (draft: { title: \"\" }) %><p><%= draft %></p>", /own state/)
        refuse("<%# herb:state (open: open_initially) %><p><%= open %></p>", /declared strict local/)
        refuse("<%# locals: (open: false) %>\n<%# herb:state (open: false) %><p><%= open %></p>", /both a strict local and a state/)
        refuse("<%# herb:state (open: false) %><%# herb:state (open: true) %><p><%= open %></p>", /declared twice/)
        refuse("<ul><% @items.each do |item| %><%# herb:state (open: false) %><li id=\"<%= item %>\"><%= open %></li><% end %></ul>" \
               "<%# herb:state (open: false) %>", /declared in both an item and its region/)
        refuse("<%# herb:state (attempts: 0) %><p><%= attempts + 1 %></p>", /computes with a state/)
        refuse("<%# herb:state (attempts: 0) %><div><% if attempts > 3 %>a<% else %>b<% end %></div>", /computes with a state/)
        refuse("<%# herb:state (sort: \"name\") %><div><% if sort == 3 %>a<% end %></div>", /String state `sort` against a Integer/)
        refuse("<%# herb:state (attempts: 0) %><div><% if attempts? %>a<% end %></div>", /only a boolean state/)
        refuse("<%# herb:state (open: false) %><div><% unless open? %>a<% end %></div>", /unless/)
        refuse("<%# herb:state (sort: \"name\") %><div><% case sort %><% when SORTS %>a<% end %></div>", /not a literal/)
      end

      test "a mixed conditional refuses the arm that reads no state" do
        refuse(
          "<%# herb:state (pending: false) %><div><% if pending? %>a<% elsif @admin %>b<% else %>c<% end %></div>",
          /reads no state/
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

        assert_match(/computes with a state/, error.message)
      end

      test "a trim-marker state directive still declares" do
        rendered = render(%(<%#- herb:state (open: false) -%><span><%= open %></span>))

        assert_includes rendered, "<span"
      end

      test "a state read inside an interpolated attribute is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (status: "") %><div class="row-<%= status %>">x</div>))
        end

        assert_match(/interpolated attribute/, error.message)
      end

      test "a negated state read in a conditional is refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          compile(%(<%# herb:state (open: false) %><% if !open %>x<% end %>))
        end

        assert_match(/computes with a state|reads a state/, error.message)
      end

      test "a keyed collection with item states still parks its skeleton" do
        template = <<~ERB
          <ul><% @items.each do |item| %><%# herb:key item %><%# herb:state (locked: true) %><li id="row_<%= item %>"><%= item %></li><% end %></ul>
        ERB

        assert_includes parked(template, { "@items" => ["a"] }), "herb-branch:0:item"
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
        source = Herb::Engine::DynamicsCompiler.new(BOOLEAN_ATTRIBUTES, filename: "app/views/test.html.erb").src
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

        assert_match(/as a presence/, error.message)
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
