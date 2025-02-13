# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractorTest < Minitest::Spec
    test "basic" do
      ruby = ERBX.extract_ruby_to_buffer("<h1><% RUBY_VERSION %></h1>")

      assert_equal "       RUBY_VERSION        ", ruby
    end

    test "basic with newlines" do
      actual = ERBX.extract_ruby_to_buffer(<<~HTML)
        <h1>
          <% RUBY_VERSION %>
        </h1>
      HTML

      assert_equal "    \n     RUBY_VERSION   \n     \n", actual
    end

    xtest "nested" do
      actual = ERBX.extract_ruby_to_buffer(<<~HTML)
        <% array = [1, 2, 3] %>

        <ul>
          <% array.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      HTML

      expected = ERBX.extract_ruby_to_buffer(<<~RUBY)
           array = [1, 2, 3]


             array.each do |item|
                  = item
             end

      RUBY

      assert_equal expected, actual
    end
  end
end
