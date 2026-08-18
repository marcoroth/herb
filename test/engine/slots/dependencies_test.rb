# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine/slot_dependencies"

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

        Herb::Engine::SlotDependencies.new(@project_path).for(path)
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

      test "names a template the way the page does" do
        entry = page_with_partial

        files = subject.payload(entry)["state"]["@query"].map { |slot| slot["file"] }.uniq

        assert_includes files, "app/views/posts/index.html.erb"
        assert_includes files, "app/views/posts/_search.html.erb"
      end

      test "reports a mode as a string once it travels" do
        entry = page_with_partial

        modes = subject.payload(entry)["state"]["@query"].map { |slot| slot["mode"] }.uniq.sort

        assert_equal ["derived", "identity"], modes
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

        element = subject.element(entry, params: { "p" => "@posts" })
        json = element.sub(/\A<template data-herb-dependencies>/, "").sub(%r{</template>\z}, "")

        assert_equal({ "p" => "@posts" }, JSON.parse(json)["params"])
      end

      test "parks the map the way statics are parked" do
        entry = page_with_partial

        element = subject.element(entry)

        assert_match(/\A<template data-herb-dependencies>/, element)
        assert_match(%r{</template>\z}, element)

        json = element.sub(/\A<template data-herb-dependencies>/, "").sub(%r{</template>\z}, "")

        assert_equal subject.payload(entry), JSON.parse(json)
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

      test "leaves a template that reaches nothing out of the map" do
        entry = write("index.html.erb", "<div>static</div>")

        assert_empty subject.across(entry)
      end
    end
  end
end
