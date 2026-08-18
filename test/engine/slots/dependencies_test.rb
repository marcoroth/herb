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
    end
  end
end
