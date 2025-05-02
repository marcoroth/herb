# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBTest < Minitest::Spec
    include SnapshotUtils

    test "interpolate on top level" do
      assert_parsed_snapshot(%(<%= hello %>))
    end

    test "interpolate in element body" do
      assert_parsed_snapshot(%(<h1><%= hello %></h1>))
    end

    test "interpolate in element body followed by text content" do
      assert_parsed_snapshot(%(<h1><%= Hello %> World</h1>))
    end

    test "interpolate in element body after text content" do
      assert_parsed_snapshot(%(<h1>Hello <%= World %></h1>))
    end

    test "interpolate in element body surrounded by text content" do
      assert_parsed_snapshot(%(<h1>Hello <%= World %> Hello</h1>))
    end

    test "interpolate inside tag" do
      assert_parsed_snapshot(%(<h1 <%= "id=test" %>></h1>))
    end

    test "interpolate inside attribute value" do
      assert_parsed_snapshot(%(<h1 id="<%= "test" %>"></h1>))
    end

    test "interpolate after attribute name" do
      assert_parsed_snapshot(%(<h1 id=<%= "test" %>></h1>))
    end

    test "interpolate inside attribute value with static content before" do
      assert_parsed_snapshot(%(<h1 class="text-white <%= "bg-black" %>"></h1>))
    end

    test "interpolate inside attribute value with static content after" do
      assert_parsed_snapshot(%(<h1 class="<%= "bg-black" %> text-white"></h1>))
    end

    test "interpolate inside attribute value with static content around" do
      assert_parsed_snapshot(%(<h1 class="text-white <%= "bg-black" %> title"></h1>))
    end

    test "interpolate inside comment" do
      assert_parsed_snapshot(%(<!-- <%= "Comment" %> -->))
    end

    test "conditional tags" do
      assert_parsed_snapshot(%(<div><% if bold? %><b><%= title %></b><% else %><b><%= title %></b><% end %></div>))
    end

    test "conditional attributes" do
      assert_parsed_snapshot(%(<div <% if odd? %> data-odd=true <% else %> data-odd=false <% end %>></div>))
    end

    test "comment" do
      assert_parsed_snapshot(%(<%# comment with a single qutote(') and double quote (") %>))
    end

    test "multi-line comment" do
      assert_parsed_snapshot(<<~HTML)
        <%#
          comment
        %>
      HTML
    end

    test "multi-line comment with Ruby keyword" do
      assert_parsed_snapshot(<<~HTML)
        <%#
          end
        %>
      HTML
    end
  end
end
