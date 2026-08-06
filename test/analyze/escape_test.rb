# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class EscapeTest < Minitest::Spec
    include SnapshotUtils

    test "escaped erb tag" do
      assert_parsed_snapshot("<%% 'Test' %%>")
    end

    test "escaped erb output tag" do
      assert_parsed_snapshot("<%%= 'Test' %%>")
    end

    test "escaped erb output tag with block" do
      assert_parsed_snapshot("<%%= tag.div do %>\n  Hello\n<% end %>")
      assert_parsed_snapshot("<%%= tag.div do %>\n  Hello\n<%% end %>")
    end

    test "escaped erb tag with block" do
      assert_parsed_snapshot("<%% [1, 2, 3].each do |item| %>\n  Hello\n<% end %>")
      assert_parsed_snapshot("<%% [1, 2, 3].each do |item| %>\n  Hello\n<%% end %>")
    end

    test "unbalanced escaped erb tag" do
      assert_parsed_snapshot("<%% if condition %>")
      assert_parsed_snapshot("<%% end %>")
      assert_parsed_snapshot("<%% else %>")
      assert_parsed_snapshot("<%% elsif other %>")
      assert_parsed_snapshot("<%% when :value %>")
      assert_parsed_snapshot("<%% [1, 2].each do |item| %>")
    end

    test "invalid ruby inside escaped erb tag" do
      assert_parsed_snapshot("<%%= some ~~ invalid ! syntax %>")
    end

    test "escaped erb tag with render" do
      assert_parsed_snapshot(%(<%%= render partial: "menu" %>), render_nodes: true)
      assert_parsed_snapshot(%(<%= render partial: "menu" %>), render_nodes: true)
    end

    test "escaped erb tag with action view tag helper" do
      assert_parsed_snapshot(%(<%%= link_to "Home", root_path %>), action_view_helpers: true)
      assert_parsed_snapshot(%(<%= link_to "Home", root_path %>), action_view_helpers: true)
    end

    test "escaped erb tag with inline case conditions" do
      assert_parsed_snapshot("<%% case x when 1 %>a<%% end %>", strict: true)
      assert_parsed_snapshot("<% case x when 1 %>a<% end %>", strict: true)
    end
  end
end
