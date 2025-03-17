# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class LinkToUnlessTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "link_to_if" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to_unless(@current_user.nil?, "Reply", { action: "reply" }) %>
      HTML
    end

    test "link_to_if with block" do
      assert_parsed_snapshot(<<~HTML)
        <%=
          link_to_unless(@current_user.nil?, "Reply", { action: "reply" }) do |name|
            link_to(name, { controller: "accounts", action: "signup" })
          end
        %>
      HTML
    end
  end
end
