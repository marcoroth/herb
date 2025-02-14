# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractHTMLTest < Minitest::Spec
    test "basic silent" do
      actual = ERBX.extract_html("<h1><% RUBY_VERSION %></h1>")

      assert_equal "<h1>                  </h1>", actual
    end

    test "basic loud" do
      actual = ERBX.extract_html("<h1><%= RUBY_VERSION %></h1>")

      assert_equal "<h1>                   </h1>", actual
    end

    test "with newlines" do
      actual = ERBX.extract_html(<<~HTML)
        <h1>
          <% RUBY_VERSION %>
        </h1>
      HTML

      assert_equal "<h1>\n                    \n</h1>\n", actual
    end

    test "nested" do
      actual = ERBX.extract_html(<<~HTML)
        <% array = [1, 2, 3] %>

        <ul>
          <% array.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      HTML

      assert_equal "                       \n\n<ul>\n                            \n    <li>           </li>\n           \n</ul>\n",
                   actual
    end
  end
end
