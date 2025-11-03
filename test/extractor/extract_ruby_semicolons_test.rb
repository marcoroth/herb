# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractRubySemicolonsTest < Minitest::Spec
    test "basic silent" do
      ruby = Herb.extract_ruby("<h1><% RUBY_VERSION %></h1>", with_semicolon: true)

      assert_equal "       RUBY_VERSION ;      ", ruby
    end

    test "basic loud" do
      ruby = Herb.extract_ruby("<h1><%= RUBY_VERSION %></h1>", with_semicolon: true)

      assert_equal "        RUBY_VERSION ;      ", ruby
    end

    test "with newlines" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <h1>
          <% RUBY_VERSION %>
        </h1>
      HTML

      assert_equal "    \n     RUBY_VERSION ; \n     \n", actual
    end

    test "nested" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <% array = [1, 2, 3] %>

        <ul>
          <% array.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      HTML

      expected = "   array = [1, 2, 3] ; \n\n    \n     array.each do |item| ; \n            item ;      \n     end ; \n     \n"

      assert_equal expected, actual
    end

    test "erb comment" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <%# comment ' %>
      HTML

      expected = "              ; \n"

      assert_equal expected, actual
    end

    test "erb comment with ruby keyword" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <%# end %>
      HTML

      expected = "        ; \n"

      assert_equal expected, actual
    end

    test "erb comment broken up over multiple lines" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <%#
          end
        %>
      HTML

      expected = "          ; \n"

      assert_equal expected, actual
    end

    test "multi-line erb comment" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <%#
          end
          end
          end
          end
        %>
      HTML

      expected = "                            ; \n"

      assert_equal expected, actual
    end

    test "erb if/end and comment on same line" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <% if %><%# comment %><% end %>
      HTML

      expected = "   if ;             ;    end ; \n"

      assert_equal expected, actual
    end

    xtest "erb if/end and Ruby comment on same line" do
      actual = Herb.extract_ruby(<<~HTML, with_semicolon: true)
        <% if %><% # comment %><% end %>
      HTML

      expected = "   if      # comment      end   \n"

      assert_equal expected, actual
    end
  end
end
