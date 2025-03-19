# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::FormHelper
  class TextFieldTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "form_with with form block argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with url: posts_path do |form| %>
          <%= form.text_field :title %>
        <% end %>
      HTML
    end

    test "form_with with f block argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_with url: posts_path do |f| %>
          <%= f.text_field :title %>
        <% end %>
      HTML
    end
  end
end
