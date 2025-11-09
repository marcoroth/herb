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
  end
end
