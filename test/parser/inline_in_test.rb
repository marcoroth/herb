# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class InlineInTest < Minitest::Spec
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

    test "one-line pattern match as elsif condition" do
      assert_parsed_snapshot(<<~HTML)
        <% if value in Integer %>
          <div>Integer</div>
        <% elsif value in String %>
          <div>String</div>
        <% else %>
          <div>Other</div>
        <% end %>
      HTML
    end

    test "one-line pattern match as while condition" do
      assert_parsed_snapshot(<<~HTML)
        <% while value in Integer %>
          <%= value %>
        <% end %>
      HTML
    end

    test "one-line pattern match as until condition" do
      assert_parsed_snapshot(<<~HTML)
        <% until value in Done %>
          <%= value %>
        <% end %>
      HTML
    end

    test "one-line pattern match in ternary expression" do
      assert_parsed_snapshot(<<~HTML)
        <%= (value in Integer) ? "yes" : "no" %>
      HTML
    end

    test "one-line pattern match inside a block body" do
      assert_parsed_snapshot(<<~HTML)
        <% items.each do |n| %>
          <% if n in Integer %>
            <%= n %>
          <% end %>
        <% end %>
      HTML
    end
  end
end
