# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class MailToTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "mail_to" do
      assert_parsed_snapshot(<<~HTML)
        <%= mail_to "me@domain.com" %>
      HTML
    end

    test "mail_to with content" do
      assert_parsed_snapshot(<<~HTML)
        <%= mail_to "me@domain.com", "My email" %>
      HTML
    end

    test "mail_to with cc and subject" do
      assert_parsed_snapshot(<<~HTML)
        <%= mail_to "me@domain.com", cc: "ccaddress@domain.com", subject: "This is an example email" %>
      HTML
    end

    test "mail_to with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= mail_to "me@domain.com" do %>
          <strong>Email me:</strong> <span>me@domain.com</span>
        <% end %>
      HTML
    end
  end
end
