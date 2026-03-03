# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class CaseWhenTest < Minitest::Spec
    include SnapshotUtils

    test "case/when" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
          <h1>Children</h1>
        <% when Integer %>
          <h1>Integer</h1>
        <% when String %>
          <h1>String</h1>
        <% else %>
          <h1>else</h1>
        <% end %>
      HTML
    end

    test "case/when with if inside else branch (issue 860)" do
      assert_parsed_snapshot(<<~HTML)
        <% case %>
        <% when true %>
          1
        <% else %>
          <% if true %>
            2
          <% end %>
        <% end %>
      HTML
    end

    test "case/when with if/elsif/else inside else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case status %>
        <% when :active %>
          <p>Active</p>
        <% else %>
          <% if admin? %>
            <p>Admin view</p>
          <% elsif moderator? %>
            <p>Moderator view</p>
          <% else %>
            <p>User view</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case/when with unless inside else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case role %>
        <% when :admin %>
          <p>Admin</p>
        <% else %>
          <% unless guest? %>
            <p>Authenticated</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case/when with nested case inside else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case type %>
        <% when :primary %>
          <p>Primary</p>
        <% else %>
          <% case subtype %>
          <% when :secondary %>
            <p>Secondary</p>
          <% when :tertiary %>
            <p>Tertiary</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case/when with multiple nested control structures in else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case status %>
        <% when :ok %>
          <p>OK</p>
        <% else %>
          <% if error? %>
            <p>Error</p>
          <% end %>
          <% unless success? %>
            <p>Not successful</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case/when with begin/rescue inside else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case result %>
        <% when :success %>
          <p>Success</p>
        <% else %>
          <% begin %>
            <p>Attempting fallback</p>
          <% rescue %>
            <p>Fallback failed</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case without when" do
      assert_parsed_snapshot(<<~HTML)
        <% case 1 %>
        <% end %>
      HTML
    end

    test "case with single when" do
      assert_parsed_snapshot(<<~HTML)
        <% case 1 %>
        <% when 1 %>
          <p>one</p>
        <% end %>
      HTML
    end
  end
end
