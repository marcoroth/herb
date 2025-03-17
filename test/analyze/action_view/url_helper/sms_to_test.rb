# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class SmsToTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "sms_to" do
      assert_parsed_snapshot(<<~HTML)
        <%= sms_to "5155555785" %>
      HTML
    end

    test "phone_to with content" do
      assert_parsed_snapshot(<<~HTML)
        <%= sms_to "5155555785", "Text me" %>
      HTML
    end

    test "phone_to with country_code" do
      assert_parsed_snapshot(<<~HTML)
        <%= sms_to "5155555785", country_code: "01" %>
      HTML
    end

    test "phone_to with body" do
      assert_parsed_snapshot(<<~HTML)
        <%= sms_to "5155555785", body: "I have a question about your product." %>
      HTML
    end

    test "phone_to with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= sms_to "5155555785" do %>
          <strong>Text me:</strong>
        <% end %>
      HTML
    end
  end
end
