# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  # A one-line pattern match (`value in pattern`) is a complete boolean expression, not a
  # `case`/`in` control flow clause. It shouldn't be treated as a case control flow block.
  #
  # See marcoroth/herb#1758.
  #
  class MatchPredicateTest < Minitest::Spec
    include SnapshotUtils

    test "one-line pattern match against regexp as if condition" do
      assert_parsed_snapshot(<<~HTML)
        <% if attribute in /...+/ %>
          <%= attribute %>
        <% end %>
      HTML
    end

    test "one-line pattern match as if/else condition" do
      assert_parsed_snapshot(<<~HTML)
        <% if 1 in Numeric %>
          <div>Text1</div>
        <% else %>
          <div>Text2</div>
        <% end %>
      HTML
    end

    test "one-line pattern match as unless condition" do
      assert_parsed_snapshot(<<~HTML)
        <% unless value in [Integer] %>
          <%= value %>
        <% end %>
      HTML
    end

    test "one-line pattern match as output expression" do
      assert_parsed_snapshot(<<~HTML)
        <%= value in [Integer] %>
      HTML
    end
  end
end
