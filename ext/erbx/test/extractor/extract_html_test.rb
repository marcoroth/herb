# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractHTMLTest < Minitest::Spec
    test "basic" do
      ruby = ERBX.extract_html_to_buffer("<h1><% RUBY_VERSION %></h1>")

      assert_equal "<h1>                  </h1>", ruby
    end

    test "basic with newlines" do
      actual = ERBX.extract_html_to_buffer(<<~HTML)
        <h1>
          <% RUBY_VERSION %>
        </h1>
      HTML

      assert_equal "<h1>\n                    \n</h1>\n", actual
    end

    test "nested" do
      actual = ERBX.extract_html_to_buffer(<<~HTML)
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
