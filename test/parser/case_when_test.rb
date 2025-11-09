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
  end
end
