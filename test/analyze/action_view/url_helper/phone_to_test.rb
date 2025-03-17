# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class PhoneToTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "phone_to" do
      assert_parsed_snapshot(<<~HTML)
        <%= phone_to "1234567890" %>
      HTML
    end

    test "phone_to with content" do
      assert_parsed_snapshot(<<~HTML)
        <%= phone_to "1234567890", "Phone me" %>
      HTML
    end

    test "phone_to with country_code" do
      assert_parsed_snapshot(<<~HTML)
        <%= phone_to "1234567890", country_code: "01" %>
      HTML
    end

    test "phone_to with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= phone_to "1234567890" do %>
          <strong>Phone me:</strong>
        <% end %>
      HTML
    end
  end
end
