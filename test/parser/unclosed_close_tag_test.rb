# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class UnclosedCloseTagTest < Minitest::Spec
    include SnapshotUtils

    test "close tag missing > followed by ERB" do
      assert_parsed_snapshot(<<~HTML)
        <% case Date.today.cwday %>
        <% when 6 %>
          <p>Today is Saturday</p
        <% else %>
          <p>Today is not a day of the week</p>
        <% end %>
      HTML
    end

    test "close tag missing > at EOF" do
      assert_parsed_snapshot(<<~HTML)
        <p>Today is Saturday</p
      HTML
    end

    test "close tag missing > followed by another HTML tag" do
      assert_parsed_snapshot(%(<div><p>Hello</p</div>))
    end

    test "close tag missing > followed by text content" do
      assert_parsed_snapshot(%(<p>Hello</p World))
    end
  end
end
