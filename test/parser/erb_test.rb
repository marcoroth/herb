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
  end
end
