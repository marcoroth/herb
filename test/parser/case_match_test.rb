# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class CaseMatchTest < Minitest::Spec
    include SnapshotUtils

    test "case/in" do
      assert_parsed_snapshot(<<~HTML)
        <% case { hash: { nested: '4' } } %>
          <span>children</span>
        <% in { hash: { nested: } } %>
          <span>nested</span>
        <% else %>
          <span>else</span>
        <% end %>
      HTML
    end

    test "case/in with if inside else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case value %>
        <% in Integer %>
          <p>Integer</p>
        <% else %>
          <% if unknown? %>
            <p>Unknown type</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case/in with nested case/in inside else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case data %>
        <% in { type: "primary" } %>
          <p>Primary</p>
        <% else %>
          <% case fallback %>
          <% in { status: "ok" } %>
            <p>OK</p>
          <% in { status: "error" } %>
            <p>Error</p>
          <% end %>
        <% end %>
      HTML
    end

    test "case/in with multiple nested structures in else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% case result %>
        <% in { success: true } %>
          <p>Success</p>
        <% else %>
          <% if retry? %>
            <p>Retrying</p>
          <% end %>
          <% unless failed? %>
            <p>Still processing</p>
          <% end %>
        <% end %>
      HTML
    end
  end
end
