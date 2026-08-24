# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slot_dependencies"
require_relative "../../../lib/herb/engine/debug_visitor"

require "tmpdir"
require "fileutils"

module Engine
  module Slots
    class DependenciesTest < Minitest::Spec
      def setup
        @project_path = Dir.mktmpdir("herb_slot_dependencies")
        @view_root = File.join(@project_path, "app", "views", "posts")

        FileUtils.mkdir_p(@view_root)
      end

      def teardown
        FileUtils.rm_rf(@project_path)
      end

      def dependencies_for(template, name: "index.html.erb")
        path = File.join(@view_root, name)

        File.write(path, template)

        Herb::Engine::SlotDependencies.new(@project_path).slots_for(path)
      end

      def write(name, template)
        path = File.join(@view_root, name)

        File.write(path, template)

        path
      end

      def subject
        Herb::Engine::SlotDependencies.new(@project_path)
      end

      def page_with_partial
        write("_search.html.erb", %(<input value="<%= term %>"><p><%= term.upcase %></p>))
        write("index.html.erb", %(<div><%= @query %></div><%= render "posts/search", term: @query %>))
      end

      test "leaves out a template the host does not compile slots for" do
        write("_plain.html.erb", "<div><%= card %></div>")
        entry = write("index.html.erb", %(<div><%= @name %></div><%= render "posts/plain", card: @name %>))

        compile = lambda { |source, file|
          next nil if File.basename(file).start_with?("_")

          visitor = Herb::Engine::SlotVisitor.new(mark: false)
          Herb::Engine.new(source, visitors: [visitor], filename: file)
          visitor
        }

        reached = Herb::Engine::SlotDependencies.new(@project_path, compile: compile).across(entry)["@name"]
        files = reached.map { |slot| File.basename(slot[:file]) }.uniq

        assert_includes files, "index.html.erb"
        refute_includes files, "_plain.html.erb"
      end

      test "says nothing at all when the host compiles no slots anywhere" do
        entry = write("index.html.erb", "<div><%= @name %></div>")

        subject = Herb::Engine::SlotDependencies.new(@project_path, compile: ->(_source, _file) {})

        assert_empty subject.across(entry)
        assert_empty subject.slots_for(entry)
        assert_nil subject.version_for(entry)
      end

      test "leaves out a template the host does not compile slots for" do
        write("_plain.html.erb", "<div><%= card %></div>")
        entry = write("index.html.erb", %(<div><%= @name %></div><%= render "posts/plain", card: @name %>))

        compile = lambda { |source, file|
          next nil if File.basename(file).start_with?("_")

          visitor = Herb::Engine::SlotVisitor.new(mark: false)
          Herb::Engine.new(source, visitors: [visitor], filename: file)
          visitor
        }

        reached = Herb::Engine::SlotDependencies.new(@project_path, compile: compile).across(entry)["@name"]
        files = reached.map { |slot| File.basename(slot[:file]) }.uniq

        assert_includes files, "index.html.erb"
        refute_includes files, "_plain.html.erb"
      end

      test "says nothing at all when the host compiles no slots anywhere" do
        entry = write("index.html.erb", "<div><%= @name %></div>")

        subject = Herb::Engine::SlotDependencies.new(@project_path, compile: ->(_source, _file) {})

        assert_empty subject.across(entry)
        assert_empty subject.slots_for(entry)
        assert_nil subject.version_for(entry)
      end

      test "finds the same state when a visitor rewrote the tree first" do
        template = %(<div><span><%= @name.presence || "x" %></span><p><%= @name.length %></p></div>)
        path = File.join(@view_root, "index.html.erb")

        File.write(path, template)

        compile = lambda { |source, file|
          visitor = Herb::Engine::SlotVisitor.new(mark: false)
          Herb::Engine.new(source, visitors: [Herb::Engine::DebugVisitor.new, visitor], filename: file)
          visitor
        }

        rewritten = Herb::Engine::SlotDependencies.new(@project_path, compile: compile).slots_for(path)
        plain = Herb::Engine::SlotDependencies.new(@project_path).slots_for(path)

        assert_equal plain.keys.sort, rewritten.keys.sort
        assert_equal(plain.values.map { |slot| slot[:state] }, rewritten.values.map { |slot| slot[:state] })
        refute_empty(rewritten.values.flat_map { |slot| slot[:state] })
      end

      test "builds the map the way the host compiles, so the versions agree" do
        template = "<div><%= @name %></div>"
        path = File.join(@view_root, "index.html.erb")

        File.write(path, template)

        marker = Herb::Engine::SlotVisitor.new
        Herb::Engine.new(template, visitors: [Herb::Engine::DebugVisitor.new, marker], filename: path)

        compile = lambda { |source, file|
          visitor = Herb::Engine::SlotVisitor.new
          Herb::Engine.new(source, visitors: [Herb::Engine::DebugVisitor.new, visitor], filename: file)
          visitor
        }

        matching = Herb::Engine::SlotDependencies.new(@project_path, compile: compile)
        bare = Herb::Engine::SlotDependencies.new(@project_path)

        assert_equal marker.schema[:version], matching.version_for(path)
        refute_equal marker.schema[:version], bare.version_for(path)
      end

      test "names the state a slot reads" do
        dependencies = dependencies_for("<div><%= @name %></div>")

        assert_equal ["@name"], dependencies[0][:state]
      end

      test "calls a slot that is the state itself an identity" do
        dependencies = dependencies_for("<div><%= @name %></div>")

        assert_equal :identity, dependencies[0][:mode]
      end

      test "calls a slot that computes from the state derived" do
        dependencies = dependencies_for("<div><%= @post.title %></div>")

        assert_equal ["@post"], dependencies[0][:state]
        assert_equal :derived, dependencies[0][:mode]
      end

      test "reads an attribute a slot writes whole as an identity" do
        dependencies = dependencies_for(%(<input value="<%= @name %>">))

        assert_equal ["@name"], dependencies[0][:state]
        assert_equal :identity, dependencies[0][:mode]
      end

      test "refuses an attribute the template only partly wrote" do
        dependencies = dependencies_for(%(<div class="card <%= @state %>"></div>))

        assert_equal ["@state"], dependencies[0][:state]
        assert_equal :derived, dependencies[0][:mode]
      end

      test "calls a conditional structural and reports only what its condition reads" do
        dependencies = dependencies_for("<div><% if @admin %><b><%= @name %></b><% end %></div>")

        assert_equal ["@admin"], dependencies[0][:state]
        assert_equal :structural, dependencies[0][:mode]
      end

      test "gives a collapsed conditional the state of every branch it stands for" do
        dependencies = dependencies_for("<% if @admin %><h1><%= @name %></h1><% else %><h1><%= @guest %></h1><% end %>")

        assert_equal ["@admin", "@guest", "@name"], dependencies[0][:state]
      end

      test "never calls a collapsed conditional an identity, since the condition picks the value" do
        dependencies = dependencies_for("<% if @admin %><h1><%= @name %></h1><% else %><h1><%= @guest %></h1><% end %>")

        assert_equal :derived, dependencies[0][:mode]
      end

      test "gives a slot inside a branch the state that branch's body reads" do
        dependencies = dependencies_for("<div><% if @admin %><b><%= @name %></b><% end %></div>")

        assert_equal ["@name"], dependencies[1][:state]
        assert_equal :identity, dependencies[1][:mode]
      end

      test "follows a collection into the slots its body renders" do
        dependencies = dependencies_for("<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>")

        assert_equal ["@items"], dependencies[0][:state]
        assert_equal :structural, dependencies[0][:mode]

        assert_equal ["@items"], dependencies[1][:state]
        assert_equal :derived, dependencies[1][:mode]
      end

      test "gives every slot of a template an entry" do
        dependencies = dependencies_for(%(<a href="<%= @url %>"><%= @label %></a>))

        assert_equal [0, 1], dependencies.keys.sort
        assert_equal ["@url"], dependencies[0][:state]
        assert_equal ["@label"], dependencies[1][:state]
      end

      test "reports a constant a slot reads, and never as an identity" do
        dependencies = dependencies_for("<div><%= Time.now %></div>")

        assert_equal ["Time.now"], dependencies[0][:state]
        assert_equal :derived, dependencies[0][:mode]
      end

      test "leaves a slot that reads no state without any" do
        dependencies = dependencies_for(%(<div><%= "hello" %></div>))

        assert_empty dependencies[0][:state]
        assert_equal :derived, dependencies[0][:mode]
      end

      test "follows state into a partial that was passed it under another name" do
        entry = page_with_partial

        reached = subject.across(entry)["@query"].map { |slot| [File.basename(slot[:file]), slot[:index], slot[:mode]] }

        assert_includes reached, ["_search.html.erb", 0, :identity]
        assert_includes reached, ["_search.html.erb", 1, :derived]
      end

      test "keys what it reaches by the name the page knows, not the partial's" do
        entry = page_with_partial

        across = subject.across(entry)

        assert_includes across.keys, "@query"
        refute_includes across.keys, "term"
      end

      test "gives every slot the version of the template it came from" do
        entry = page_with_partial

        versions = subject.across(entry)["@query"].group_by { |slot| File.basename(slot[:file]) }.transform_values { |slots| slots.map { |slot| slot[:version] }.uniq }

        assert_equal 1, versions["index.html.erb"].size
        assert_equal 1, versions["_search.html.erb"].size
        refute_equal versions["index.html.erb"], versions["_search.html.erb"]
      end

      def named_by(strategy)
        Herb::Engine::SlotDependencies.new(
          @project_path,
          compile: lambda { |source, path|
            visitor = Herb::Engine::SlotVisitor.new(mark: false, identifier: strategy)

            Herb::Engine.new(source, visitors: [visitor], filename: path, project_path: @project_path)

            visitor
          }
        )
      end

      test "names a template the way the markers do when they carry a digest" do
        entry = write("index.html.erb", %(<input value="<%= @query %>">))
        files = named_by(:digest).payload(entry)["state"]["@query"].map { |slot| slot["file"] }

        assert_equal [Digest::SHA256.hexdigest("app/views/posts/index.html.erb").slice(0, 12)], files
      end

      test "names a template the way the markers do when a caller names them" do
        entry = write("index.html.erb", %(<input value="<%= @query %>">))
        files = named_by(->(path) { "v1/#{path}" }).payload(entry)["state"]["@query"].map { |slot| slot["file"] }

        assert_equal ["v1/app/views/posts/index.html.erb"], files
      end

      test "names a template the way the page does" do
        entry = page_with_partial

        files = subject.payload(entry)["state"]["@query"].map { |slot| slot["file"] }.uniq

        assert_includes files, "app/views/posts/index.html.erb"
        assert_includes files, "app/views/posts/_search.html.erb"
      end

      test "sends only the slots a page may write itself" do
        entry = page_with_partial
        indices = subject.payload(entry)["state"]["@query"]

        assert_equal subject.across(entry)["@query"].count { |slot| slot[:mode] == :identity }, indices.size
        assert(indices.none? { |slot| slot.key?("mode") })
      end

      test "says what a request calls a template's state" do
        entry = write("index.html.erb", %(<input value="<%= @query %>">))

        assert_equal({ "query" => "@query" }, subject.payload(entry)["params"])
      end

      test "takes the name a caller declares for state a request spells differently" do
        entry = write("index.html.erb", "<ul><% @posts.each do |post| %><li><%= post %></li><% end %></ul>")

        params = subject.payload(entry, params: { "p" => "@posts" })["params"]

        assert_equal({ "p" => "@posts" }, params)
      end

      test "leaves out state a request cannot set" do
        entry = write("index.html.erb", "<div><%= Time.now %></div>")

        assert_empty subject.payload(entry)["params"]
      end

      test "carries the declared names into the parked map" do
        entry = write("index.html.erb", "<ul><% @posts.each do |post| %><li><%= post %></li><% end %></ul>")

        tag = subject.dependencies_tag(entry, params: { "p" => "@posts" })
        json = tag.sub(/\A<template data-herb-dependencies>/, "").sub(%r{</template>\z}, "")

        assert_equal({ "p" => "@posts" }, JSON.parse(json)["params"])
      end

      test "parks the map the way statics are parked" do
        entry = page_with_partial

        tag = subject.dependencies_tag(entry)

        assert_match(/\A<template data-herb-dependencies>/, tag)
        assert_match(%r{</template>\z}, tag)

        json = tag.sub(/\A<template data-herb-dependencies>/, "").sub(%r{</template>\z}, "")

        assert_equal subject.payload(entry), JSON.parse(json)
      end

      test "follows state into a partial rendered inside an each block" do
        write("_card.html.erb", "<div><%= card.title %></div>")
        entry = write("index.html.erb", %(<% @posts.each do |post| %><%= render "posts/card", card: post %><% end %>))

        files = subject.across(entry)["@posts"].map { |slot| File.basename(slot[:file]) }

        assert_includes files, "_card.html.erb"
      end

      test "leaves an item template reached through an each block to the server" do
        write("_card.html.erb", "<div><%= card %></div>")
        entry = write("index.html.erb", %(<% @posts.each do |post| %><%= render "posts/card", card: post %><% end %>))

        card = subject.across(entry)["@posts"].find { |slot| File.basename(slot[:file]) == "_card.html.erb" }

        assert_equal :derived, card[:mode]
      end

      test "leaves everything an each block's item template renders to the server" do
        write("_name.html.erb", "<span><%= card %></span>")
        write("_card.html.erb", %(<div><%= render "posts/name", card: card %></div>))
        entry = write("index.html.erb", %(<% @posts.each do |post| %><%= render "posts/card", card: post %><% end %>))

        modes = subject.across(entry)["@posts"].reject { |slot| File.basename(slot[:file]) == "index.html.erb" }.map { |slot| slot[:mode] }

        refute_empty modes
        assert_equal [:derived], modes.uniq
      end

      test "keeps writing a partial rendered inside a block that runs once" do
        write("_field.html.erb", "<div><%= card %></div>")
        entry = write("index.html.erb", %(<% form_with model: @post do |f| %><%= render "posts/field", card: @post %><% end %>))

        field = subject.across(entry)["@post"].find { |slot| File.basename(slot[:file]) == "_field.html.erb" }

        assert_equal :identity, field[:mode]
      end

      test "leaves a collection's item template to the server" do
        write("_card.html.erb", "<div><%= card %></div>")
        entry = write("index.html.erb", %(<%= render partial: "posts/card", collection: @posts %>))

        card = subject.across(entry)["@posts"].find { |slot| File.basename(slot[:file]) == "_card.html.erb" }

        assert_equal :derived, card[:mode]
      end

      test "keeps writing a partial that was rendered once" do
        write("_card.html.erb", "<div><%= card %></div>")
        entry = write("index.html.erb", %(<%= render "posts/card", card: @post %>))

        card = subject.across(entry)["@post"].find { |slot| File.basename(slot[:file]) == "_card.html.erb" }

        assert_equal :identity, card[:mode]
      end

      test "leaves everything below a collection to the server" do
        write("_name.html.erb", "<span><%= card %></span>")
        write("_card.html.erb", %(<div><%= render "posts/name", card: card %></div>))
        entry = write("index.html.erb", %(<%= render partial: "posts/card", collection: @posts %>))

        modes = subject.across(entry)["@posts"].reject { |slot| File.basename(slot[:file]) == "index.html.erb" }.map { |slot| slot[:mode] }

        refute_empty modes
        assert_equal [:derived], modes.uniq
      end

      test "asks for markup only where values cannot answer" do
        entry = write("index.html.erb", "<div><% if @admin %><b><%= @name %></b><% end %></div>")

        assert_equal([0], subject.subtree_slots(entry, ["@admin"]).map { |slot| slot[:index] })
      end

      test "leaves a value change to the values" do
        entry = write("index.html.erb", "<div><% if @admin %><b><%= @name %></b><% end %></div>")

        assert_empty subject.subtree_slots(entry, ["@name"])
      end

      test "asks for a collection that changed" do
        entry = write("index.html.erb", "<ul><% @items.each do |item| %><li><%= item %></li><% end %></ul>")

        slots = subject.subtree_slots(entry, ["@items"])

        assert_equal [:structural], slots.map { |slot| slot[:mode] }.uniq
      end

      test "says nothing about state the page does not read" do
        entry = write("index.html.erb", "<div><% if @admin %><b>x</b><% end %></div>")

        assert_empty subject.subtree_slots(entry, ["@nothing"])
      end

      test "never calls a constant an identity, so a page is never sent one to write" do
        entry = write("index.html.erb", "<div><%= Post.count %></div>")

        assert_equal([:derived], subject.across(entry)["Post.count"].map { |slot| slot[:mode] })
        assert_empty subject.payload(entry)["state"]["Post.count"]
      end

      test "leaves a constant out of the names a request can set" do
        entry = write("index.html.erb", "<div><%= Post.count %></div>")

        assert_empty subject.payload(entry)["params"]
      end

      test "leaves a template that reaches nothing out of the map" do
        entry = write("index.html.erb", "<div>static</div>")

        assert_empty subject.across(entry)
      end
      test "carries the presence a boolean attribute compares" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (draft: "", sending: false) %>
          <p><%= draft %></p>
          <button disabled="<%= draft == "" %>">Send</button>
          <video muted="<%= sending %>"></video>
        ERB

        manifest = subject.payload(path)["states"].values.first

        assert_equal [["draft", { "value" => "" }], ["sending", nil]], manifest["presence"].values
        assert_equal manifest["presence"].keys.map(&:to_i).sort, (manifest["reads"]["draft"] + manifest["reads"]["sending"]).sort - manifest["reads"]["draft"].take(1)
      end

      test "carries a combo presence and registers every state it reads" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (pending: false, failed: false) %>
          <input disabled="<%= pending? || failed? %>">
          <div><% if pending? && failed? %>Stuck<% else %>Fine<% end %></div>
        ERB

        manifest = subject.payload(path)["states"].values.first

        assert_equal [{ "any" => [["pending", nil], ["failed", nil]] }], manifest["presence"].values

        index = manifest["presence"].keys.first.to_i

        assert_includes manifest["reads"]["pending"], index
        assert_includes manifest["reads"]["failed"], index

        conditional = manifest["conditionals"].values.first

        assert_equal [{ "branch" => 0, "condition" => { "all" => [["pending", nil], ["failed", nil]] } }], conditional["arms"]
      end

      test "carries a derived state with its condition" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (pending: false, failed: false, busy: pending || failed) %>
          <div><% if busy %>Busy<% else %>Idle<% end %></div>
        ERB

        manifest = subject.payload(path)["states"].values.first
        declaration = manifest["declarations"].find { |declared| declared["name"] == "busy" }

        assert_equal "boolean", declaration["kind"].to_s
        assert_equal({ "any" => [["pending", nil], ["failed", nil]] }, declaration["derived"])
      end

      test "carries a counted state with its fold" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (pending_count: 0) %>
          <ul>
            <% @messages.each do |message| %>
              <%# herb:key message.id %>
              <%# herb:state (pending: false) %>
              <% if pending? %><% pending_count += 1 %><% end %>
              <li id="<%= message.id %>"><%= message.body %></li>
            <% end %>
          </ul>
          <p><%= pending_count %></p>
        ERB

        manifest = subject.payload(path)["states"].values.first
        declaration = manifest["declarations"].find { |declared| declared["name"] == "pending_count" }

        assert_equal({ "collection" => 0, "when" => ["pending", nil], "by" => 1 }, declaration["count"])
        assert_includes manifest["reads"]["pending_count"], 3
      end

      test "binds a tag helper input that reads a state" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (draft: "", agreed: false) %>
          <%= tag.input value: draft %>
          <%= tag.input type: "checkbox", checked: agreed %>
        ERB

        manifest = subject.payload(path)["states"].values.first

        assert_equal [0], manifest["reads"]["draft"]
        assert_equal [0], manifest["bound"]["draft"]
        assert_equal [["agreed", nil]], manifest["presence"].values
        assert_equal [1], manifest["bound"]["agreed"]
      end

      test "carries the states a template declares" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (pending: false, attempts: 0) %>
          <div><%= @query %></div>
          <p><%= attempts %></p>
          <span><% if pending? %>wait<% else %>done<% end %></span>
        ERB

        payload = subject.payload(path)
        manifest = payload["states"].values.first

        names = manifest["declarations"].map { |declaration| declaration["name"] }

        assert_equal ["pending", "attempts"], names
        assert_equal ["region"], manifest["declarations"].map { |declaration| declaration["scope"] }.uniq
        assert_equal 1, manifest["reads"]["attempts"].size

        conditional = manifest["conditionals"].values.first

        assert_equal [{ "branch" => 0, "condition" => ["pending", nil] }], conditional["arms"]
        assert_equal 1, conditional["else"]
        assert_equal subject.version_for(path), manifest["version"]
      end

      test "marks a state read into a form control as bound" do
        path = write("index.html.erb", <<~ERB)
          <%# herb:state (draft: "", agreed: false) %>
          <input value="<%= draft %>">
          <input type="checkbox" checked="<%= agreed %>">
          <p><%= draft %></p>
        ERB

        manifest = subject.payload(path)["states"].values.first

        assert_equal 2, manifest["reads"]["draft"].size
        assert_equal 1, manifest["bound"]["draft"].size
        assert_equal 1, manifest["bound"]["agreed"].size
        refute_includes manifest["bound"]["draft"], manifest["reads"]["draft"].last
      end

      test "counts a state read in an interpolated attribute" do
        path = write("index.html.erb", %(<%# herb:state (status: "") %><div class="row-<%= status %>">x</div>))

        manifest = subject.payload(path)["states"].values.first

        assert_equal [0], manifest["reads"]["status"]
        assert_empty manifest["bound"]
      end

      test "carries the states of a partial no server state reaches" do
        write("_menu.html.erb", %(<%# herb:state (open: false) %><nav><%= open %></nav>))
        path = write("index.html.erb", %(<div><%= render "menu" %></div>))

        manifests = subject.payload(path)["states"]

        assert_equal(["open"], manifests.values.compact.flat_map { |manifest| manifest["declarations"].map { |declaration| declaration["name"] } })
      end

      test "carries no states section entry for a template that declares none" do
        path = write("index.html.erb", "<div><%= @query %></div>")

        assert_empty subject.payload(path)["states"]
      end
    end
  end
end
