# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class EscapedERBTest < Minitest::Spec
    include SnapshotUtils

    test "escaped if closed by real end" do
      assert_parsed_snapshot(<<~ERB)
        <%% if true %>
          content
        <% end %>
      ERB
    end

    test "real if closed by escaped end" do
      assert_parsed_snapshot(<<~ERB)
        <% if true %>
          content
        <%% end %>
      ERB
    end

    test "escaped if closed by escaped end" do
      assert_parsed_snapshot(<<~ERB)
        <%% if true %>
          content
        <%% end %>
      ERB
    end

    test "real if closed by real end" do
      assert_parsed_snapshot(<<~ERB)
        <% if true %>
          content
        <% end %>
      ERB
    end

    test "escaped block closed by real end" do
      assert_parsed_snapshot(<<~ERB)
        <%% items.each do |item| %>
          content
        <% end %>
      ERB
    end

    test "real block closed by escaped end" do
      assert_parsed_snapshot(<<~ERB)
        <% items.each do |item| %>
          content
        <%% end %>
      ERB
    end

    test "escaped block closed by escaped end" do
      assert_parsed_snapshot(<<~ERB)
        <%% items.each do |item| %>
          content
        <%% end %>
      ERB
    end
  end
end
