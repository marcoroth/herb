# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"

module Engine
  module Slots
    class ManifestTest < Minitest::Spec
      def compile(template, mode: :client)
        visitor = Herb::Engine::Slots::Visitor.new(mode: mode)

        Herb::Engine.new(template, visitors: [visitor], filename: "app/views/posts/index.html.erb")

        visitor
      end

      def manifest(template, mode: :client)
        compile(template, mode: mode).manifest
      end

      test "names the template the way the markers do" do
        built = manifest("<p><%= @name %></p>")

        assert_equal "app/views/posts/index.html.erb", built["file"]
        assert_equal "app/views/posts/index.html.erb", built["identifier"]
        assert_equal compile("<p><%= @name %></p>").version, built["version"]
      end

      test "carries a name the template wrote on an element" do
        built = manifest(%(<ul data-herb-name="rows"><% @items.each do |r| %><li><%= r %></li><% end %></ul>))

        assert_equal({ "rows" => 0 }, built["names"])
      end

      test "carries the static stretches of an interpolated attribute" do
        built = manifest(%(<div class="row-<%= @kind %>-of-<%= @size %>">x</div>))

        assert_equal({ "0" => ["row-", "-of-", ""] }, built["parts"])
      end

      test "carries no parts for an attribute that is one whole expression" do
        assert_empty manifest(%(<div class="<%= @kind %>">x</div>))["parts"]
      end

      test "carries the states the template declares" do
        built = manifest(%(<%# herb:state (filter: "all") %><div><% if filter == "all" %>every<% end %></div>))
        declaration = built["states"]["declarations"].fetch(0)

        assert_equal "filter", declaration["name"]
        assert_equal "all", declaration["value"]
        assert_equal({ "0" => { "arms" => [{ "branch" => 0, "condition" => ["filter", { "value" => "all" }] }], "else" => nil } }, built["states"]["conditionals"])
      end

      test "says nothing about states for a template that declares none" do
        assert_nil manifest("<p><%= @name %></p>")["states"]
      end

      test "leaves out what a page works out for itself" do
        built = manifest(%(<%# herb:state (draft: "") %><input value="<%= draft %>">))

        refute built["states"].key?("bound"), "bound follows from the anchor, so a page derives it"
      end

      test "describes a template compiled in server mode the same way" do
        client = manifest(%(<li class="row-<%= @c %>"><%= @n %></li>))
        server = manifest(%(<li class="row-<%= @c %>"><%= @n %></li>), mode: :server)

        assert_equal client, server
      end
    end
  end
end
