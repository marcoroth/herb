# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractRubyTest < Minitest::Spec
    test "basic silent" do
      ruby = Herb.extract_ruby("<h1><% RUBY_VERSION %></h1>")

      assert_equal "       RUBY_VERSION        ", ruby
    end

    test "basic loud" do
      ruby = Herb.extract_ruby("<h1><%= RUBY_VERSION %></h1>")

      assert_equal "        RUBY_VERSION        ", ruby
    end

    test "with newlines" do
      actual = Herb.extract_ruby(<<~HTML)
        <h1>
          <% RUBY_VERSION %>
        </h1>
      HTML

      assert_equal "    \n     RUBY_VERSION   \n     \n", actual
    end

    test "nested" do
      actual = Herb.extract_ruby(<<~HTML)
        <% array = [1, 2, 3] %>

        <ul>
          <% array.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      HTML

      expected = "   array = [1, 2, 3]   \n\n    \n     array.each do |item|   \n            item        \n     end   \n     \n"

      assert_equal expected, actual
    end

    test "erb comment" do
      actual = Herb.extract_ruby(<<~HTML)
        <%# comment ' %>
      HTML

      expected = "  # comment '   \n"

      assert_equal expected, actual
    end
  end
end
