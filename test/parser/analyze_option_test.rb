# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class AnalyzeOptionTest < Minitest::Spec
    include SnapshotUtils

    test "analyze enabled by default transforms ERB nodes" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
        <% end %>
      HTML
    end

    test "analyze disabled skips ERB node transformation" do
      assert_parsed_snapshot(<<~HTML, analyze: false)
        <% if true %>
        <% end %>
      HTML
    end
  end
end
