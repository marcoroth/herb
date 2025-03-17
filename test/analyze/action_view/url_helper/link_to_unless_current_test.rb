# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class LinkToUnlessCurrentTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "link_to_unless_current" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to_unless_current("Home", { action: "index" }) %>
      HTML
    end

    test "link_to_unless_current with block" do
      assert_parsed_snapshot(<<~HTML)
        <%=
            link_to_unless_current("Comment", { controller: "comments", action: "new" }) do
              link_to("Go back", { controller: "posts", action: "index" })
            end
        %>
      HTML
    end
  end
end
