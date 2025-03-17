# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class LinkToIfTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "link_to_if" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to_if(@current_user.nil?, "Login", { controller: "sessions", action: "new" }) %>
      HTML
    end

    test "link_to_if with block" do
      assert_parsed_snapshot(<<~HTML)
        <%=
          link_to_if(@current_user.nil?, "Login", { controller: "sessions", action: "new" }) do
            link_to(@current_user.login, { controller: "accounts", action: "show", id: @current_user })
          end
        %>
      HTML
    end
  end
end
